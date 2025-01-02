import pandas as pd
import os
import glob
def merge():
    working_dir = os.path.dirname(__file__)
    input_dir = os.path.join(working_dir, "rawdata")
    output_dir = os.path.join(working_dir, "data")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    csv_files = glob.glob(os.path.join(input_dir, "observations_*.csv"))
    #print(len(csv_files))
    all_data = pd.concat([pd.read_csv(f) for f in csv_files[:len(csv_files)]])
    all_data.to_csv(os.path.join(output_dir, "merged_observations.csv"), index=False)
    print("All CSV files have been merged into merged_observations.csv")


def flush_file(file):
    with open(file, "w", encoding="UTF-8") as f: 
        f.write("")

def concat(file1, file2, skip_header=False):
    with open(file2, 'r') as filename2:
        data = filename2.readlines()
    if skip_header:
        data = data[1:]
    with open(file1, 'a') as filename1:
        filename1.writelines(data)

def memory_effective_merge():
    working_dir = os.path.dirname(__file__)
    input_dir = os.path.join(working_dir, "rawdata")
    output_dir = os.path.join(working_dir, "data")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    csv_files = glob.glob(os.path.join(input_dir, "observations_*.csv"))
    output_file = os.path.join(output_dir, "merged_observations.csv")
    flush_file(output_file)
    for i, filename in enumerate(csv_files):
        concat(output_file, filename, skip_header=(i != 0))
    print(f"All CSV files have been merged into {output_file}")
    

if __name__ == "__main__":
    merge()