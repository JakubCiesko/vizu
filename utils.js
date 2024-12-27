import { stationInfo } from "./dataLoader.js";

export const units = {
    "ta_2m": "°C", 
    "ws_avg": "m/s", 
    "pr_1h": "mm/hod",
    "pa": "hPa", 
    "rh": "%", 
    "wd_avg": "°"
};

export const variableToFullName = {
    "ta_2m": "Temperature",
    "ws_avg": "Wind Speed",
    "pr_1h": "Precipitation",
    "pa": "Pressure",
    "rh": "Relative Humidity",
    "wd_avg": "Wind Direction"
};

export const fullNameToVariable = {
    "Temperature (°C)": "ta_2m",
    "Wind Speed (m/s)": "ws_avg",
    "Precipitation (mm/hod)": "pr_1h",
    "Pressure (hPa)": "pa",
    "Relative Humidity (%)": "rh",
    "Wind Direction (°)": "wd_avg"
};

export function getValueByDate(data, date) {
    const entry = data.find(item => item.date === date);
    if (entry) {
        const parsedEntry = Object.keys(entry).reduce((acc, key) => {
            if (key !== 'date') {
                const value = parseFloat(entry[key]);
                acc[key] = isNaN(value) ? NaN : value;
            } else {
                acc[key] = entry[key]; // Keep the 'date' key as is
            }
            return acc;
        }, {});
        return parsedEntry;
    }
    return `Date ${date} not found`;
}


export function getValueByDateAndStation(data, date, stationCode) {
    const entry = getValueByDate(data, date);
    if (typeof entry === 'object') {
        const value = entry[stationCode];
        if (value !== undefined) {
            return value;
        } else {
            return `Station code ${stationCode} not found`;
        }
    } else {
        return entry;
    }
}

function findExtreme(data, fn){
    var extrema = [];
    for (let row of data) {
        var {date, ...numericData} = row;
        var nonNanData = [];
        for (let nd of Object.values(numericData)) {
            if (isNaN(nd))
                continue;
            nonNanData.push(nd);
        }
        extrema.push(fn(...nonNanData));
    }
    return fn(...extrema);
}

export function findMax(data){
    return findExtreme(data, Math.max);
}

export function findMin(data){
    return findExtreme(data, Math.min);
}


const stationArray = [];
for (const [code, info] of Object.entries(stationInfo)){
    stationArray.push(info.name + " (" + code +  ")");
}

export function searchStation(query){
    var matchedKeys = [];
    query = query.trim();
    if (query === "")
        return matchedKeys;
    for (let station of stationArray){
        if (station.toUpperCase().indexOf(query.toUpperCase()) > -1)
            matchedKeys.push(station);
    }
    return matchedKeys;
}