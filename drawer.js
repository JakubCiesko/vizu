import { getValueByDateAndStation, getValueByDate, units, variableToFullName, fullNameToVariable, findMax, findMin, searchStation} from "./utils.js";

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
    setUpExcludeCheckbox();
    setUpDatePicker();
    drawMap(data, stationInfo);
    setUpVariableSelector();
    updateMeasurementDetails(data, stationInfo[selectedStation].name);
    setUpSearchBar();
    
    createLineChart(data[selectedVariable]);
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
                d3.selectAll("#rangeVariableSpan").text(variableToFullName[selectedVariable]);
            updateMeasurementDetails(globalData, globalStationInfo[selectedStation].name);
            setUpRangeSlider();  
            updateVisualization(true); 
        }
        
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
    switch (selectedVariable) {
        case "wd_avg":
            createRoseDiagram(globalData[selectedVariable]);
            break;
        case "pr_1h":
            createBarChart(globalData[selectedVariable]);
            break;
        default:
            createLineChart(globalData[selectedVariable]);
    }
}

function createLineChart(data) {
    const plottingData = data
        .filter(d => !isNaN(d[selectedStation]))
        .map(d => ({
            x: new Date(d.date),
            y: d[selectedStation]
        }));

    const graphContainer = document.getElementById('graph');
    const containerWidth = graphContainer.offsetWidth;

    const defaultOptions = {
        width: containerWidth,
        height: 800,
        margin: { top: 50, right: 50, bottom: 50, left: 50 },
        xLabel: "Date",
        yLabel: variableToFullName[selectedVariable] + " [" + units[selectedVariable] + "]",
        lineColor: "#17a2b8",
        pointRadius: 30,
    };

    const config = { ...defaultOptions };
    const { width, height, margin, xLabel, yLabel, lineColor, pointRadius } = config;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    d3.select("#graph").selectAll("*").remove();

    const svg = d3
        .select("#graph")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // Clipping path to prevent elements from overflowing the chart
    svg.append("defs")
        .append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("x", 0)
        .attr("y", 0);

    const chartArea = svg
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const xScale = d3
        .scaleTime()
        .domain(d3.extent(plottingData, d => d.x))
        .range([0, innerWidth]);

    const yScale = d3
        .scaleLinear()
        .domain([d3.min(plottingData, d => d.y), d3.max(plottingData, d => d.y)])
        .range([innerHeight, 0]);

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    const xAxisGroup = chartArea
        .append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    const yAxisGroup = chartArea
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
        .x(d => xScale(d.x))
        .y(d => yScale(d.y));
    

    const linePath = chartArea
        .append("path")
        .datum(plottingData)
        .attr("fill", "none")
        .attr("stroke", lineColor)
        .attr("stroke-width", 2)
        .attr("d", lineGenerator)
        .attr("clip-path", "url(#clip)"); // Apply clipping path
    // add clickable points on the line so that date can be selected
    // Zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 10]) // Zoom scale
        .translateExtent([[0, 0], [width, height]]) // Translate bounds
        .on("zoom", zoomed);

    svg.call(zoom);

    let currentTransform = null;

    function zoomed({ transform }) {
        currentTransform = transform;
        const newXScale = transform.rescaleX(xScale);
        const newYScale = transform.rescaleY(yScale);

        xAxisGroup.call(xAxis.scale(newXScale));
        yAxisGroup.call(yAxis.scale(newYScale));

        linePath.attr("d", lineGenerator.x(d => newXScale(d.x)).y(d => newYScale(d.y)));
    }

    // Focus Cursor Implementation
    const bisect = d3.bisector(d => d.x).left;

    // Circle for focus
    const focus = chartArea.append("g")
        .append("circle")
        .style("fill", "none")
        .attr("stroke", "black")
        .attr("r", 8.5)
        .style("opacity", 0);

    // Text for focus
    const focusText = chartArea.append("g")
        .append("text")
        .style("opacity", 0)
        .attr("text-anchor", "left")
        .attr("alignment-baseline", "middle");

    // Rectangle to capture mouse events
    chartArea.append('rect')
        .style("fill", "none")
        .style("pointer-events", "all")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .on('mouseover', mouseover)
        .on('mousemove', mousemove)
        .on('mouseout', mouseout);

    function mouseover() {
        focus.style("opacity", 1);
        focusText.style("opacity", 1);
    }

    function mousemove(event) {
        if (!currentTransform) return;

        const newXScale = currentTransform.rescaleX(xScale);
        const newYScale = currentTransform.rescaleY(yScale);
        const mouseX = d3.pointer(event)[0];
        const x0 = newXScale.invert(mouseX); // Get the closest x value
        const i = bisect(plottingData, x0, 1);
        const d0 = plottingData[i - 1];
        const d1 = plottingData[i];
        const d = x0 - d0.x > d1.x - x0 ? d1 : d0;

        focus.attr("cx", newXScale(d.x)).attr("cy", newYScale(d.y));
        focusText
            .html(`Date: ${d.x.toLocaleDateString()}  ${variableToFullName[selectedVariable]}: ${d.y}`)
            .attr("x", newXScale(d.x) + 15)
            .attr("y", newYScale(d.y));
    }

    function mouseout() {
        focus.style("opacity", 0);
        focusText.style("opacity", 0);
    }
}





function createRoseDiagram(data){
    const bins = [
    { direction: "N", start: 0, end: 45 },
    { direction: "NE", start: 45, end: 90 },
    { direction: "E", start: 90, end: 135 },
    { direction: "SE", start: 135, end: 180 },
    { direction: "S", start: 180, end: 225 },
    { direction: "SW", start: 225, end: 270 },
    { direction: "W", start: 270, end: 315 },
    { direction: "NW", start: 315, end: 360 },
    ];
    
    const directionCounts = bins.map((bin) => {
    return {
        direction: bin.direction,
        count: data.filter(d => {
        return d[selectedStation] >= bin.start && d[selectedStation] < bin.end;
        }).length
    };
    });
    bins.forEach(bin => {
        const matchingCount = directionCounts.find(d => d.direction === bin.direction);
        bin.count = matchingCount ? matchingCount.count : 0;
    });
    
    const width = 0.80*window.innerWidth;
    const height = 800;
    const innerRadius = 50;
    const outerRadius = Math.min(width, height) / 2 - 10;
    const angleOffset = -5; 

    d3.select("#graph").selectAll("*").remove();

    const svg = d3
        .select("#graph")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("font-family", "sans-serif");
  
    const g = svg.append("g")
        .attr("transform", `translate(${width/2},${height/2})`);
  
    const y = d3.scaleLinear()
        .domain([0, d3.max(directionCounts, d => d.count)])
        .range([innerRadius, outerRadius]);

    const x = d3.scaleBand()
        .domain(bins.map(d => d.direction))
        .range([0, 2 * Math.PI])
        .padding(0.05);

    g.append("g").attr("class", "axes")
        .selectAll(".axis")
        .data(bins)
        .join("g")
        .attr("class", "axis")
        .attr("transform", (d, i) => `rotate(${(x(d.direction) + x.bandwidth() / 2) * 180 / Math.PI - 90})`)
        .append("line")
            .attr("x1", innerRadius)
            .attr("x2", outerRadius)
            .attr("stroke", "gray")
            .attr("stroke-dasharray", "1,4");

    var colorScale = d3.scaleOrdinal()
    .domain(bins.map(d => d.direction)) 
    .range(d3.schemeBlues[directionCounts.length]); 


    g.append("g")
        .attr("class", "rings")
        .selectAll(".ring")
        .data(directionCounts)
        .join("g")
            .attr("fill", (d, i) => colorScale(d.direction)) 
            .selectAll("path")
            .data((d) => [d])
            .join("path")
            .attr("d", d3.arc()
                .innerRadius(0)
                .outerRadius(d => y(d.count))
                .startAngle(d => x(d.direction))
                .endAngle(d => x(d.direction) + x.bandwidth())
                .padAngle(0.01))
            .attr("transform", `rotate(${angleOffset})`);

    const label = g.append("g")
        .attr("class", "direction-labels")
        .selectAll("g")
        .data(bins)
        .join("g")
        .attr("text-anchor", "middle")
        .attr("transform", (d) => 
            `rotate(${(x(d.direction) + x.bandwidth() / 2) * 180 / Math.PI - 90}) translate(${outerRadius + 20},0)`
        );

    label.append("text")
        .attr("transform", (d) => 
            (x(d.direction) + x.bandwidth() / 2 + Math.PI / 2) % (2 * Math.PI) < Math.PI 
            ? "rotate(90)translate(0,6)" 
            : "rotate(-90)translate(0,6)"
        )
        .text((d) => `${d.direction} (${d.count} days)`)
        .attr("font-weight", 500)
        .attr("font-size", 12);
} 