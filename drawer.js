import { getValueByDateAndStation, getValueByDate, units, variableToFullName, fullNameToVariable, findMax, findMin} from "./utils.js";

const geoViewBox = [16.848889, 49.613333, 22.564722, 47.739167]; //[16.848889, 49.613333, 22.564722, 47.739167];
const [minLong, maxLat, maxLong, minLat] = geoViewBox;

var map;
var slider = document.getElementById('valRangeDiv');


var selectedVariable = "ta_2m";
var selectedDate = "2024-12-01";
var selectedStation = "ASBA"; 
var excludeStations = true;
var previousVariable = selectedVariable;
var previousDate = selectedDate;
var previousStation = selectedStation;
var globalData; 
var globalStationInfo;
var maxVals = {};
var minVals = {}; 


export async function initVizualization(data, stationInfo) {
    globalData = data; 
    globalStationInfo = stationInfo;
    getExtremeValues(data);
    setUpRangeSlider();
    let stationName = stationInfo[selectedStation].name;
    setUpExcludeCheckbox();
    setUpDatePicker();
    drawMap(data, stationInfo);
    setUpVariableSelector();
    updateMeasurementDetails(data, stationName);
    
    //createLineChart(data[selectedVariable]);
}

function getExtremeValues(data){
    for (const [variable, measurements] of Object.entries(data)){
        maxVals[variable] = findMax(measurements);
        minVals[variable] = findMin(measurements);
    }
}

function destroyExistingSlider(){
    if(slider && slider.noUiSlider){
      slider.noUiSlider.destroy();
    }
}

function setUpRangeSlider(){
    destroyExistingSlider();
    var min = minVals[selectedVariable];
    var max = maxVals[selectedVariable];
    noUiSlider.create(slider, {
        start: [min, max],
        pips: {
            mode: 'steps',
            density: 3,
            format: {
                to: function (value) {return value + units[selectedVariable];},
                from: function (value) {return Number(value.replace(units[selectedVariable], ""));}
            }
        },
        tooltips: [
            true, 
            true
        ],
        connect: true,
        range: {
            'min': min,
            'max': max
        }
    });
    slider.noUiSlider.on("change", () => {updateVisualization(true)});
    /*const valRange = d3.select("#valRange").node(); 
    console.log(minVals, maxVals, selectedVariable); //WEIRD VALUES!!!
    valRange.min = minVals[selectedVariable];
    valRange.max = maxVals[selectedVariable];*/
}

function setUpExcludeCheckbox(){
    d3.selectAll("#exclude")
        .on("change", () => {
            excludeStations = !excludeStations;
            updateVisualization(true);
        });
}

function setUpDatePicker(){
    d3.selectAll("#datePicker")
        .on("change", () => {
            previousDate = selectedDate;
            selectedDate = d3.select("#datePicker").node().value;
            updateVisualization(true);
            updateMeasurementDetails(globalData, globalStationInfo[selectedStation].name)
        })
}

function updateMeasurementDetails(data, stationName){
    let value = getValueByDateAndStation(data[selectedVariable], selectedDate, selectedStation);
    const measurementSpan = d3.select("#measurement");
    const stationSpan = d3.select("#station");
    const dateSpan = d3.select("#date");
    const valueSpan = d3.select("#value");
    measurementSpan.text(variableToFullName[selectedVariable]);
    stationSpan.text(stationName + " (" + selectedStation + ")");
    const dateObj = new Date(selectedDate);
    const day = dateObj.getDate(); 
    const month = dateObj.getMonth() + 1; 
    const year = dateObj.getFullYear();
    const formattedDate = `${day}. ${month}. ${year}`;
    dateSpan.text(formattedDate);
    if (typeof value === 'number') {
        valueSpan.text(value + " " + units[selectedVariable]);
    } else {
        valueSpan.text(value);
    }
}

function drawMap(data, stationInfo){
    d3.xml("./static/blank_map_of_Slovakia.svg")
        .then((d) => {
            d3.select("#map-container").node().append(d.documentElement);
            d3.select("#map-container").select("svg")
                .attr("id", "map")
                .attr("width", "100%")
                .attr("height", "100%");
            map = d3.select("#map");
            map.selectAll("path")
                .style("fill", "lightgray")
                .style("stroke", "gray")
                .style("stroke-width", 3)
                drawStations(data, stationInfo, excludeStations);
        })      
        .catch((error) => {
            console.error("Error loading the SVG:", error);
        });
}

function drawStations(data, stationInfo, excludeStations){
    const viewBoxWidth = 7000.2445; //cx: 6970 --> most east, 10 --> most west cy: 60 --> most north, 3345 --> most south  
    const viewBoxHeight = 3374.2379; 
    const geoCenter = [(minLong + maxLong) / 2, (minLat + maxLat) / 2];
    const projection = d3.geoMercator()
        .center(geoCenter)
        .fitSize([viewBoxWidth, viewBoxHeight], {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: [[
                        [minLong, maxLat],
                        [maxLong, maxLat],
                        [maxLong, minLat],
                        [minLong, minLat],
                        [minLong, maxLat]
                    ]]
                }
            }]
        });
    
    const thatDayValues = getValueByDate(data[selectedVariable], selectedDate);
    const range = slider.noUiSlider.get();
    range[0] = Number(range[0]);
    range[1] = Number(range[1]);
    for (const [stationCode, stationData] of Object.entries(stationInfo)) {
        if (isNaN(thatDayValues[stationCode]) && excludeStations)
            continue;
        if (!(thatDayValues[stationCode] >= range[0] && thatDayValues[stationCode] <= range[1]))
            continue;
        let projectedCoords = projection([stationData.lon, stationData.lat]);    
        const circle = map.append("circle")
            .attr("cx", projectedCoords[0])
            .attr("cy", projectedCoords[1])
            .attr("r", 50)
            .attr("class", "station-circle")
            .attr("id", stationCode)
            .on("click", function() {
                previousStation = selectedStation;
                selectedStation = this.id;
                d3.select(this)
                    .classed("station-circle", false)
                    .classed("station-circle-selected", true);
                d3.select("#" + previousStation)
                    .classed("station-circle", true)
                    .classed("station-circle-selected", false);
                updateMeasurementDetails(globalData, globalStationInfo[selectedStation].name); 
                updateVisualization();
            });
        
        d3.selectAll("#" + selectedStation).classed("station-circle-selected", true).classed("station-circle", false);

        const tooltip = d3.select("body").append("div")
            .style("position", "absolute")
            .style("background", "#fff")
            .style("padding", "5px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("opacity", 0)
            .text(stationData.name + " (" + stationCode + ")" + " " + thatDayValues[stationCode] + " " + units[selectedVariable]);
        circle
            .on("mouseover", (event) => {
                tooltip
                    .style("opacity", 1)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY + 10) + "px");
            })
            .on("mousemove", (event) => {
                tooltip
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY + 10) + "px");
            })
            .on("mouseout", () => {
                tooltip.style("opacity", 0);
            });
    }
}

function setUpVariableSelector(){
    d3.selectAll(".variable-selector").on("click", function() {
        const variableText = d3.select(this).text().trim();
        if (fullNameToVariable[variableText]) {
            previousVariable = selectedVariable;
            selectedVariable = fullNameToVariable[variableText];
            d3.select("#" + previousVariable)
                .classed("variable-selector-selected", false);
            d3.select(this)
                .classed("variable-selector-selected", true);  
            updateVisualization(true); 
        }
        d3.selectAll("#rangeVariableSpan").text(variableToFullName[selectedVariable]);
        updateMeasurementDetails(globalData, globalStationInfo[selectedStation].name);
        setUpRangeSlider();
    });
    d3.selectAll("#" + selectedVariable).classed("variable-selector-selected", true);
    d3.selectAll("#rangeVariableSpan").text(variableToFullName[selectedVariable]);
}

function clearMap(){
    d3.selectAll("circle").remove();
}

function updateVisualization(clear=false){
    if (clear)
        clearMap();
    drawStations(globalData, globalStationInfo, excludeStations);
    //updateMeasurementDetails(globalData, globalStationInfo[selectedStation].name);
    //createLineChart(globalData[selectedVariable]);
}


function createLineChart(data){
    const defaultOptions = {
        width: 800,
        height: 400,
        margin: { top: 50, right: 50, bottom: 50, left: 50 },
        xLabel: "X Axis",
        yLabel: "Y Axis",
        lineColor: "steelblue",
        pointRadius: 3,
    };
    const config = {...defaultOptions};
    const { width, height, margin, xLabel, yLabel, lineColor, pointRadius } = config;
    d3.select("#graph").selectAll("*").remove(); //clear chart
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const svg = d3
        .select("#graph")
        .append("svg")
        .attr("width", width)
        .attr("height", height);
    const chartArea = svg
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    const xScale = d3
        .scaleTime()
        .domain(d3.extent(data, d => d.date)) // Assumes data.x contains Date objects
        .range([0, innerWidth]);
    
    const yScale = d3
        .scaleLinear()
        .domain([0, d3.max(data, d => d[selectedStation])])
        .range([innerHeight, 0]);
    
    const xAxis = d3.axisBottom(xScale).ticks(6);
    const yAxis = d3.axisLeft(yScale);

    chartArea
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(xAxis);

    chartArea
        .append("g")
        .attr("class", "y-axis")
        .call(yAxis);
    
    svg
        .append("text")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${margin.left / 2}, ${margin.top + innerHeight / 2}) rotate(-90)`)
        .text(yLabel);

    svg
        .append("text")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${margin.left + innerWidth / 2}, ${height - margin.bottom / 4})`)
        .text(xLabel);
    const lineGenerator = d3
        .line()
        .x(d => xScale(d.date))
        .y(d => yScale(d[selectedStation]));

    // Append the line to the chart
    chartArea
        .append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", lineColor)
        .attr("stroke-width", 2)
        .attr("d", lineGenerator);

    // Add data points (optional)
    chartArea
        .selectAll(".data-point")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "data-point")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", pointRadius)
        .attr("fill", lineColor)
        .attr("stroke", "white")
        .attr("stroke-width", 1);

}