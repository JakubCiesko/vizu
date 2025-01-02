import { getValueByDateAndStation, getValueByDate, units, variableToFullName, fullNameToVariable, findMax, findMin, searchStation, variableDescriptions} from "./utils.js";
import { drawChart, createLineChart, createScatterplot, createTwoLineChart } from "./charts.js";
import { stationInfo } from "./dataLoader.js";

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
var colorSchemes = {};


export async function initVizualization(data, stationInfo) {
    globalData = data; 
    globalStationInfo = stationInfo;
    getExtremeValues(data);
    setUpRangeSlider();
    setUpExcludeCheckbox();
    setUpDatePicker();
    drawMap(data, stationInfo);
    setUpVariableSelector();
    updateMeasurementDetails(data, stationInfo[selectedStation].name);
    setUpSearchBar();
    createLineChart(data[selectedVariable], selectedStation, selectedVariable);
    createChartTitleDescription();
    setUpComparisonSettings();
}

function search(){
    var foundStations = searchStation(document.getElementById("station-search").value);
    var searchResultsUL = d3.select("#searchResults");
    searchResultsUL.selectAll("*").remove();
    for (let foundStation of foundStations){
        searchResultsUL
            .append("li")
            .attr("class", "list-group-item")
            .text(foundStation)
            .on("click", () => {
                let codeIndex = foundStation.indexOf("(") + 1; 
                let code = foundStation.slice(codeIndex, foundStation.length - 1);
                previousStation = selectedStation;
                selectedStation = code;
                updateVisualization();
                updateMeasurementDetails(globalData, globalStationInfo[code].name);
                searchResultsUL.selectAll("*").remove();
            });
    }
}

function setUpSearchBar(){
    d3.select("#station-search").on("change", search);
    d3.select("#find-station").on("click", search);
}

function getColorSchemes() {
    for (var variable of Object.keys(variableToFullName)) {
        const colorScale = d3.scaleLinear()
            .domain([minVals[variable], maxVals[variable]]) 
            .range([0, 1]); 

        switch (variable) {
            case "ta_2m":
                colorSchemes[variable] = (value) => d3.interpolateRdYlBu(1 - colorScale(value));
                break;
            case "ws_avg":
                colorSchemes[variable] = (value) => d3.interpolateYlGnBu(colorScale(value));
                break;
            case "pr_1h":
                const pr1hColorScale = d3.scalePow()
                    .exponent(0.2) 
                    .domain([minVals[variable], maxVals[variable]])
                    .range([0, 1]);
                colorSchemes[variable] = (value) => d3.interpolateBlues(pr1hColorScale(value));
                break;
            case "pa":
                colorSchemes[variable] = (value) => d3.interpolateCividis(colorScale(value));
                break;
            case "rh":
                colorSchemes[variable] = (value) => d3.interpolateBuGn(colorScale(value));
                break;
            case "wd_avg":
                colorSchemes[variable] = (value) => {
                    if (value >= 0 && value < 45) return "#ffffcc";    // N
                    if (value >= 45 && value < 90) return "#c7e9b4";   // NE
                    if (value >= 90 && value < 135) return "#7fcdbb";  // E
                    if (value >= 135 && value < 180) return "#41b6c4"; // SE
                    if (value >= 180 && value < 225) return "#2c7fb8"; // S
                    if (value >= 225 && value < 270) return "#253494"; // SW
                    if (value >= 270 && value < 315) return "#081d58"; // W
                    if (value >= 315 && value <= 360) return "#001f3f"; // NW
                    return "#17a2b8"; // Fallback color
                };
                break;
            default:
                colorSchemes[variable] = (value) => "#17a2b8";
                break;
        }
    }
}


function getExtremeValues(data){
    for (const [variable, measurements] of Object.entries(data)){
        maxVals[variable] = findMax(measurements);
        minVals[variable] = findMin(measurements);
    }
    getColorSchemes();
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
                .style("fill", "#d1dbe4")
                .style("stroke", "gray")
                .style("stroke-width", 3);
            drawStations(data, stationInfo, excludeStations);
            drawLegend(map.node().width.baseVal.value / 3);
        })      
        .catch((error) => {
            console.error("Error loading the SVG:", error);
        });
}

function drawLegend(width){
    const legendWidth = width;
    const legendHeight = 20;
    const numStops = 10;
    const selectedColorScheme = colorSchemes[selectedVariable];
    d3.selectAll("#map-legend").remove();
    const legendContainer = d3.select("#map-container")
        .append("div")
        .attr("id", "map-legend")
        .style("text-align", "right")
        .style("margin-top", "-10px");
    const legendSvg = legendContainer.append("svg")
        .attr("width", legendWidth)
        .attr("height", 50);

    const gradientId = "legendGradient";
    const defs = legendSvg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "0%")
        .attr("y2", "0%");

    const stops = d3.range(numStops + 1).map(i => i / numStops);
    stops.forEach((stop, i) => {
        linearGradient.append("stop")
            .attr("offset", stop * 100 + "%")
            .attr("stop-color", selectedColorScheme(minVals[selectedVariable] + stop * (maxVals[selectedVariable] - minVals[selectedVariable])));
    });
    legendSvg.append("rect")
        .attr("x", 0)
        .attr("y", 10)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", `url(#${gradientId})`);
    legendSvg.append("text")
        .attr("x", 0)
        .attr("y", 45)
        .attr("fill", "black")
        .attr("font-size", "14px")
        .attr("text-anchor", "start")
        .text(minVals[selectedVariable] + " " + units[selectedVariable]);
    legendSvg.append("text")
        .attr("x", legendWidth)
        .attr("y", 45)
        .attr("fill", "black")
        .attr("font-size", "14px")
        .attr("text-anchor", "end")
        .text(maxVals[selectedVariable] + " " + units[selectedVariable]);
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
        if (!((!excludeStations && isNaN(thatDayValues[stationCode])) || (thatDayValues[stationCode] >= range[0] && thatDayValues[stationCode] <= range[1])))
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
            })
            .style("fill", colorSchemes[selectedVariable](thatDayValues[stationCode]));
            
        d3.selectAll("#" + selectedStation).classed("station-circle-selected", true).classed("station-circle", false); //color 
        

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
                d3.selectAll("#rangeVariableSpan").text(variableToFullName[selectedVariable]);
            updateMeasurementDetails(globalData, globalStationInfo[selectedStation].name);
            setUpRangeSlider();  
            updateVisualization(true);
            drawLegend(d3.select("#map").node().width.baseVal.value / 3);
        }
        
    });
    d3.selectAll("#" + selectedVariable).classed("variable-selector-selected", true);
    d3.selectAll("#rangeVariableSpan").text(variableToFullName[selectedVariable]);
}

function clearMap(){
    d3.selectAll("circle").remove();
}

function createChartTitleDescription(){
    const graphTitleVarSpan = d3.select("#graphTitleVar");
    const graphTitleStationSpan = d3.select("#graphTitleStationName");
    const graphDescription = d3.select("#plotDescription");
    graphTitleVarSpan.text(variableToFullName[selectedVariable]);
    graphTitleStationSpan.text(globalStationInfo[selectedStation].name);
    
    const stationPosition = stationInfo[selectedStation];
    const elevation = stationPosition.elev;
    const longitude = stationPosition.lon;
    const latitude = stationPosition.lat;
    const descriptionHtml = `
        <p>${variableDescriptions[selectedVariable]}</p>
        <p><strong>Station Location:</strong></p>
        <ul>
            <li><strong>Latitude:</strong> ${latitude.toFixed(2)}°</li>
            <li><strong>Longitude:</strong> ${longitude.toFixed(2)}°</li>
            <li><strong>Elevation:</strong> ${elevation.toFixed(2)} m</li>
        </ul>
    `;
    graphDescription.html(descriptionHtml);
}

function updateVisualization(clear=false){
    if (clear)
        clearMap();
    drawStations(globalData, globalStationInfo, excludeStations);
    createChartTitleDescription();
    drawChart(globalData, selectedStation, selectedVariable);
}

function createDropdown(id, label, options, visibleOptions) {
    return `
        <div class="form-group">
            <label for="${id}">${label}</label>
            <select class="form-control" id="${id}">
                ${options.map((option, i) => `<option value="${option}">${visibleOptions[i]}</option>`).join("")}
            </select>
        </div>
    `;
}


function setUpComparisonSettings(){
    const visibleStations = Object.values(globalStationInfo).map(e => {return e.name;});
    const stations = Object.keys(globalStationInfo);
    const variables = Object.keys(variableToFullName).filter(e => e !== "wd_avg");
    const visibleVariables = Object.entries(variableToFullName)
        .filter(([key]) => key !== "wd_avg")
        .map(([_, value]) => value);
    
    const comparisonTypeOptions = d3.select("#comparisonTypeOptions")
        .append("div")
        .attr("class", "form-group")
        .html(`
            <label>Comparison Type</label><br>
            <input type="radio" id="compareStation" name="comparisonType" value="station" checked> Compare Stations<br>
            <input type="radio" id="compareVariable" name="comparisonType" value="variable"> Compare Variables
        `);
    d3.selectAll("input[name='comparisonType']").on("change", function() {
            const selectedType = this.value;
            updateMenuOptions(selectedType);
    });

    function updateMenuOptions(selectedType) {
        const menuOptions = d3.select("#menuOptions");
        menuOptions.selectAll("*").remove();
        if (selectedType === "station") {
            menuOptions.html(
                createDropdown("station1", "Station 1", stations, visibleStations) +
                createDropdown("station2", "Station 2", stations, visibleStations) +
                createDropdown("variable", "Variable", variables, visibleVariables)
            );
        } else if (selectedType === "variable") {
            menuOptions.html(
                createDropdown("variable1", "Variable 1", variables, visibleVariables) +
                createDropdown("variable2", "Variable 2", variables, visibleVariables) +
                createDropdown("stationVar", "Station", stations, visibleStations)
            );
        }
    }
    updateMenuOptions("station"); 
    document.getElementById("station2").value = "ASIB"; 
    document.getElementById("station1").value = selectedStation;
    d3.select("#compareButton").on("click", compare);
    createTwoLineChart(globalData, d3.select("#station1").node().value, d3.select("#station2").node().value, d3.select("#variable").node().value)
}

function compare() {
    const selectedType = d3.select("input[name='comparisonType']:checked").node().value;
    if (selectedType === "station") {
        // Get selected station 1, station 2, and variable
        const station1 = d3.select("#station1").node().value;
        const station2 = d3.select("#station2").node().value;
        const variable = d3.select("#variable").node().value;

        // Use the selected stations and variable to generate the comparison graph
        createTwoLineChart(globalData, station1, station2, variable);
    } else if (selectedType === "variable") {
        // Get selected variables and station
        const variable1 = d3.select("#variable1").node().value;
        const variable2 = d3.select("#variable2").node().value;
        const station = d3.select("#stationVar").node().value;

        // Use the selected variables and station to generate the comparison graph
        createScatterplot(globalData, [variable1, variable2], station);
    }
}

function debounce(func, timeout = 200) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), timeout);
    };
}

const debouncedResize = debounce(() => {
    updateVisualization(true); // Redraw only after resizing is complete
    compare();
}, 300);

window.addEventListener('resize', debouncedResize);