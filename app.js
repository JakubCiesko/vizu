import {loadData } from "./dataLoader.js";
import { initVizualization } from "./drawer.js";

const csvUrls = [
    "./data/pa_data.csv",
    "./data/pr_1h_data.csv",
    "./data/rh_data.csv",
    "./data/ta_2m_data.csv",
    "./data/wd_avg_data.csv",
    "./data/ws_avg_data.csv",
];

var data; 
var stationInfo;


async function init(){
    const result = await loadData(csvUrls);
    data = result.data;
    stationInfo = result.stationInfo;
    initVizualization(data, stationInfo);
}


init();
