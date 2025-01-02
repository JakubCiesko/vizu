import requests
import os
import time
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

COOLDOWN_DELAY = 5

def fetch(start_from_latest=True, break_loop_after_fails=5):
    scanned_days = 0
    working_dir = os.path.dirname(__file__)
    output_dir = os.path.join(working_dir, "rawdata")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    base_url = "http://meteo.shmu.sk/customer/home/opendata/"
    if start_from_latest:
        with open(os.path.join(working_dir, "latest.txt"), "r", encoding="UTF-8") as f: 
            start_date = datetime.strptime(f.read(), "%d.%m.%Y")
    else: 
        start_date = datetime(2019, 3, 21)
    end_date = datetime.now()
    current_date = start_date
    loop_fail = 0
    while current_date <= end_date:
        if break_loop_after_fails == loop_fail:
            break
        if ((scanned_days + 1) % 25) == 0:
            print(f"Waiting for {COOLDOWN_DELAY} s")
            time.sleep(COOLDOWN_DELAY)
            print("Cooled down")
        try:
            date_str = current_date.strftime('%d.%m.%Y')
            response = requests.get(f"{base_url}?date={date_str}")
            soup = BeautifulSoup(response.content, 'html.parser')
            with open(os.path.join(working_dir, "latest.txt"), "w", encoding="UTF-8") as f: 
                f.write(current_date.strftime("%d.%m.%Y"))
            if h1:=soup.find("h1"):
                if h1.text == "ERROR":
                    print(f"ERROR, cooling down twice (for {COOLDOWN_DELAY * 2} s)")
                    time.sleep(COOLDOWN_DELAY * 2)
                    print("Continuing after error")
                    loop_fail += 1 
                    continue
            scanned_days += 1
        except Exception as e:
            print(e)
            break 
        link = soup.find('a', href=lambda href: href and "observations" in href)
        if link:
            csv_url = base_url + link['href']
            csv_data = requests.get(csv_url)
            
            filename = f"observations_{date_str}.csv"
            filepath = os.path.join(output_dir, filename) 
            with open(filepath, 'wb') as file:
                file.write(csv_data.content)
            print(f"Downloaded: observations_{date_str}.csv")
        
        current_date += timedelta(days=1)
    print("Done fetching data")

if __name__ == "__main__":
    fetch()
