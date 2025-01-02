
import { variableToFullName, units } from "./utils.js";

export function drawChart(data, selectedStation, selectedVariable){
    switch (selectedVariable) {
        case "wd_avg":
            createRoseDiagram(data[selectedVariable], selectedStation, selectedVariable);
            break;
        case "pr_1h":
            createBarChart(data[selectedVariable], selectedStation, selectedVariable);
            break;
        default:
            createLineChart(data[selectedVariable], selectedStation, selectedVariable);
    }
}

function extractPlottingData(data, selectedStation){
    const plottingData = data
        .filter(d => !isNaN(d[selectedStation]))
        .map(d => ({
            x: new Date(d.date),
            y: d[selectedStation]
        }));
    return plottingData;
}

function setUpSVG(margin, xLabel, yLabel, height=800){
    const graphContainer = document.getElementById('graph');
    const width = graphContainer.offsetWidth;
	const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
	d3.select("#graph").selectAll("*").remove();
	
	const svg = d3
        .select("#graph")
        .append("svg")
        .attr("width", width)
        .attr("height", height);
    
    svg.append("defs")
        .append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("x", 0)
        .attr("y", 0);
    
    svg
        .append("text")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${margin.left / 2}, ${margin.top + innerHeight / 2}) rotate(-90)`)
        .style("font-size", "25px")  // Increase font size
        .text(yLabel);

    svg
        .append("text")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${margin.left + innerWidth / 2}, ${height - margin.bottom / 4})`)
        .style("font-size", "25px")  // Increase font size
        .text(xLabel);

	return svg;
}

function setUpChartArea(svg, margin){
	const chartArea = svg
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
	return chartArea;
}

function setUpXScale(plottingData,innerWidth) {
	return d3
        .scaleTime()
        .domain(d3.extent(plottingData, d => d.x))
        .range([0, innerWidth]);
}

function setUpYScale(min, max, innerHeight){
	return d3
        .scaleLinear()
        .domain([min, max])
        .range([innerHeight, 0]);
}

function setUpXAxisGroup(chartArea, innerHeight, xAxis, fontSize="14px"){
	const xAxisGroup = chartArea
        .append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);
	xAxisGroup.selectAll("text")
        .style("font-size", fontSize);
	return xAxisGroup;
}

function setUpYAxisGroup(chartArea, yAxis, fontSize="14px"){
	const yAxisGroup = chartArea
        .append("g")
        .attr("class", "y-axis")
        .call(yAxis);
	yAxisGroup.selectAll("text")
        .style("font-size", fontSize); 
	return yAxisGroup;
}

function addZoom(
    linePath,
    lineGenerator, 
    currentTransform,
    xAxis, 
    yAxis, 
    xScale, 
    yScale, 
    xAxisGroup, 
    yAxisGroup, 
    width, 
    height, 
    updateTransformCallback,
    fontSize="14px"
){
    const zoom = d3.zoom()
            .scaleExtent([1, 10]) 
            .translateExtent([[0, 0], [width, height]]) 
            .on("zoom", zoomed);
    
    function zoomed({ transform }) {
            currentTransform = transform;
            const newXScale = transform.rescaleX(xScale);
            const newYScale = transform.rescaleY(yScale);
    
            xAxisGroup.call(xAxis.scale(newXScale));
            yAxisGroup.call(yAxis.scale(newYScale));
            xAxisGroup.selectAll("text")
                .style("font-size", fontSize);      
            yAxisGroup.selectAll("text")
                .style("font-size", fontSize); 
    
            linePath.attr("d", lineGenerator.x(d => newXScale(d.x)).y(d => newYScale(d.y)));
            updateTransformCallback(transform);
        }
    return zoom;
}

function addCursor(
    plottingData, 
    chartArea, 
    innerWidth, 
    innerHeight, 
    getCurrentTransform, 
    xScale, 
    yScale, 
    selectedVariable, 
    cursorRadius=8.5, 
    fontSize="25px"
){
    const bisect = d3.bisector(d => d.x).left;

    const focus = chartArea.append("g")
        .append("circle")
        .style("fill", "none")
        .attr("stroke", "#b82d17")
        .attr("r", cursorRadius)
        .style("opacity", 0);

    const focusText = chartArea.append("g")
        .append("text")
        .style("opacity", 0)
        .attr("text-anchor", "left")
        .attr("alignment-baseline", "middle")
        .style("font-size", fontSize);  

    chartArea.append("rect")
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
        const currentTransform = getCurrentTransform();
        if (!currentTransform) return;

        const newXScale = currentTransform.rescaleX(xScale);
        const newYScale = currentTransform.rescaleY(yScale);
        const mouseX = d3.pointer(event)[0];
        const x0 = newXScale.invert(mouseX); 
        const i = bisect(plottingData, x0, 1);
        const d0 = plottingData[i - 1];
        const d1 = plottingData[i];
        const d = x0 - d0.x > d1.x - x0 ? d1 : d0;

        focus.attr("cx", newXScale(d.x)).attr("cy", newYScale(d.y));
        focusText
            .html(`Date: ${d.x.toLocaleDateString()}  ${variableToFullName[selectedVariable]}: ${d.y} ${units[selectedVariable]}`)
            .attr("x", newXScale(d.x) + 15)
            .attr("y", newYScale(d.y));
    }

    function mouseout() {
        focus.style("opacity", 0);
        focusText.style("opacity", 0);
    }
}


export function createLineChart(data, selectedStation, selectedVariable) {
    const plottingData = extractPlottingData(data, selectedStation);

    const graphContainer = document.getElementById('graph');
    const containerWidth = graphContainer.offsetWidth;

    const defaultOptions = {
        width: containerWidth,
        height: 800,
        margin: { top: 50, right: 50, bottom: 50, left: 75 },
        xLabel: "Date",
        yLabel: variableToFullName[selectedVariable] + " [" + units[selectedVariable] + "]",
        lineColor: "#17a2b8"
    };

    const config = { ...defaultOptions };
    const { width, height, margin, xLabel, yLabel, lineColor } = config;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    d3.select("#graph").selectAll("*").remove();

    const svg = setUpSVG(margin, xLabel, yLabel);
    const chartArea = setUpChartArea(svg, margin);
    
    const xScale = setUpXScale(plottingData, innerWidth);
    const yScale = setUpYScale(d3.min(plottingData, d => d.y), d3.max(plottingData, d => d.y), innerHeight);
    
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    const xAxisGroup = setUpXAxisGroup(chartArea, innerHeight, xAxis);
    const yAxisGroup = setUpYAxisGroup(chartArea, yAxis);
    
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
        .attr("clip-path", "url(#clip)"); 

    let currentTransform = null;
    const zoom = addZoom(
        linePath, 
        lineGenerator,
        currentTransform,
        xAxis, 
        yAxis, 
        xScale, 
        yScale, 
        xAxisGroup, 
        yAxisGroup, 
        width, 
        height, 
        (transform) => { currentTransform = transform; } 
    );
    svg.call(zoom);
    addCursor(
        plottingData, 
        chartArea, 
        innerWidth, 
        innerHeight, 
        () => currentTransform, 
        xScale, 
        yScale, 
        selectedVariable
    );
}


export function createBarChart(data, selectedStation, selectedVariable) {
    const plottingData = extractPlottingData(data, selectedStation);

    const graphContainer = document.getElementById('graph');
    const containerWidth = graphContainer.offsetWidth;

    const defaultOptions = {
        width: containerWidth,
        height: 800,
        margin: { top: 50, right: 50, bottom: 125, left: 75 },
        xLabel: "Date",
        yLabel: variableToFullName[selectedVariable] + " [" + units[selectedVariable] + "]",
        barColor: "#17a2b8",
    };

    const config = { ...defaultOptions };
    const { width, height, margin, xLabel, yLabel, barColor } = config;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    d3.select("#graph").selectAll("*").remove();

    const svg = d3.select("#graph")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    
    svg.append("defs")
        .append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", innerWidth)
        .attr("height", innerHeight);

    // Use scaleTime for the x-axis (dates as time)
    const xScale = d3.scaleTime()
        .domain([new Date(plottingData[0].x), new Date(plottingData[plottingData.length - 1].x)])  // Set time range based on data
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(plottingData, d => d.y)])
        .range([innerHeight, 0]);

    // Format the X-axis tick labels (date)
    const xAxis = d3.axisBottom(xScale)
        .ticks(d3.timeYear.every(1))  // Default tick interval is yearly
        .tickFormat(d3.timeFormat("%Y"));  // Format dates as Year (e.g., 2020)

    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(xAxis)
        .attr("class", "x-axis")
        .selectAll("text")
        .style("font-size", "14px");

    svg.append("g")
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .style("font-size", "14px");

    svg.append("text")
        .attr("transform", "rotate(-90)") 
        .attr("x", -(innerHeight / 2))   
        .attr("y", -margin.left + 20)   
        .attr("text-anchor", "middle")  
        .style("font-size", "25px")
        .text(yLabel);
    
    svg.append("text")
        .attr("x", innerWidth / 2) 
        .attr("y", innerHeight + margin.bottom - 40)
        .attr("text-anchor", "middle")
        .style("font-size", "25px")
        .text(xLabel);

    // Zoom functionality
    const zoom = d3.zoom()
        .scaleExtent([1, 60]) // Limits zoom scale
        .translateExtent([[0, 0], [innerWidth, innerHeight]]) // Limits panning
        .on("zoom", zoomed); 

    
    // Add zoom rectangle FIRST
    svg.append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .style("fill", "none")
    .style("pointer-events", "all") // Important for zooming but prevents blocking bars
    .call(zoom);

    // Create the tooltip element
    const tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("padding", "10px")
    .style("border-radius", "5px")
    .style("box-shadow", "0 2px 5px rgba(0, 0, 0, 0.3)")
    .style("font-size", "12px")
    .style("pointer-events", "none") // Prevent the tooltip from interfering with mouse events
    .style("visibility", "hidden"); // Initially hidden

    // Add bars AFTER zoom rectangle
    const bars = svg.selectAll("rect.bar") // Add class for easier identification
        .data(plottingData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(new Date(d.x)))  // x position based on time
        .attr("width", function(d, i) {
            const nextX = (i + 1 < plottingData.length) ? xScale(new Date(plottingData[i + 1].x)) : innerWidth;
            return Math.max(1, nextX - xScale(new Date(d.x)) - 1); // Ensure the width is at least 1
        })
        .attr("fill", barColor)
        .attr("height", 0)
        .attr("y", innerHeight)
        .attr("clip-path", "url(#clip)")  // Apply clipping path to the bars
        .on("mouseover", function (event, d) {
            // Show tooltip on mouseover
            tooltip.style("visibility", "visible")
                .html(`
                    <strong>Date:</strong> ${new Date(d.x).toLocaleDateString()}<br>
                    <strong>${variableToFullName[selectedVariable]}:</strong> ${d.y} ${units[selectedVariable]}
                `)
                .style("left", `${event.pageX + 10}px`) // Position tooltip near the cursor
                .style("top", `${event.pageY - 20}px`);
            d3.select(this).attr("fill", d3.color(barColor).darker(1)); // Highlight bar
        })
        .on("mousemove", function (event) {
            // Move tooltip with the cursor
            tooltip.style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY - 20}px`);
        })
        .on("mouseout", function () {
            // Hide tooltip and reset bar color
            tooltip.style("visibility", "hidden");
            d3.select(this).attr("fill", barColor);
        });

    // Animate bars to their correct height
    bars.transition()
        .duration(800)
        .attr("y", d => yScale(d.y))
        .attr("height", d => innerHeight - yScale(d.y))
        .delay((d, i) => i * 0.5);

    function zoomed(event) {
        const transform = event.transform;
        
        // Rescale the xScale based on zoom
        const newXScale = transform.rescaleX(d3.scaleTime()
            .domain([new Date(plottingData[0].x), new Date(plottingData[plottingData.length - 1].x)])
            .range([0, innerWidth]));
        
        const zoomLevel = transform.k;
        let tickInterval;
        let tickFormat;
        
        if (zoomLevel > 45) {
            tickInterval = d3.timeDay.every(1);  // Daily ticks
            tickFormat = d3.timeFormat("%b %d %Y");  // Format: Month Day Year
        } else if (zoomLevel > 3) {
            tickInterval = d3.timeMonth.every(1);  // Monthly ticks
            tickFormat = d3.timeFormat("%b %Y");  // Format: Month Year
        } else {
            tickInterval = d3.timeYear.every(1);  // Yearly ticks
            tickFormat = d3.timeFormat("%Y");  // Format: Year
        }
        
        // Update the x-axis with the new scale and dynamic ticks
        const axis = svg.select("g.x-axis")
            .call(d3.axisBottom(newXScale).ticks(tickInterval).tickFormat(tickFormat)); // Adjust tick formatting based on zoom
        
        // Rotate daily ticks and increase their font size
        axis.selectAll("text")
            .style("font-size", "14px")  // Set font size to 14px
            .style("text-anchor", "middle")  // Ensure text is centered
            .style("transform", "rotate(0deg)");  // Reset to 0 degree rotation by default
        
        if (zoomLevel > 45) {
            // Rotate daily ticks by 45 degrees for better visibility
            axis.selectAll("text")
                .style("transform", "rotate(45deg)")
                .style("font-size", "12px")
                .style("text-anchor", "start");  // Align the text to start
        }
        
        // Update bars' positions based on new scale
        bars.attr("x", d => newXScale(new Date(d.x)))
            .attr("width", function(d, i) {
                const nextX = (i + 1 < plottingData.length) ? newXScale(new Date(plottingData[i + 1].x)) : innerWidth;
                return Math.max(1, nextX - newXScale(new Date(d.x)) - 1); // Ensure the width is at least 1
            });
    }
}

function createRoseDiagram(data, selectedStation, selectedVariable) {
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

    const width = 0.80 * window.innerWidth;
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
        .attr("transform", `translate(${width / 2},${height / 2})`);

    const y = d3.scaleLinear()
        .domain([0, d3.max(directionCounts, d => d.count)])
        .range([innerRadius, outerRadius]);

    const x = d3.scaleBand()
        .domain(bins.map(d => d.direction))
        .range([0, 2 * Math.PI])
        .padding(0.05);
    
    const colorScale = d3.scaleOrdinal()
        .domain(bins.map(d => d.direction)) 
        .range(d3.schemeYlGnBu[directionCounts.length]); 

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

    // Add the legend
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - 150}, ${height / 4})`); // Position on the right side

    bins.forEach((bin, i) => {
        const legendRow = legend.append("g")
            .attr("transform", `translate(0, ${i * 20})`); // Space each row

        legendRow.append("rect")
            .attr("width", 18)
            .attr("height", 18)
            .attr("fill", colorScale(bin.direction));

        legendRow.append("text")
            .attr("x", 25)
            .attr("y", 9) // Center the text vertically
            .attr("dy", "0.35em")
            .style("font-size", "12px")
            .text(bin.direction);
    });
}

export function createScatterplot(data, selectedVariables, station) {
    const variable1 = selectedVariables[0]; // First selected variable
    const variable2 = selectedVariables[1]; // Second selected variable
    const data1 = data[variable1];
    const data2 = data[variable2];
    
    const plotData = data1.map(function(e, i) {
        if (!isNaN(e[station]) && !isNaN(data2[i][station])) {
            return { x: +e[station], y: +data2[i][station], d: new Date(e.date)};
        }
    }).filter(d => d !== undefined);
    const graphContainer = document.getElementById('comparisonGraph');
    const containerWidth = graphContainer.offsetWidth;

    const defaultOptions = {
        width: containerWidth,
        height: 800,
        margin: { top: 50, right: 50, bottom: 125, left: 75 },
        xLabel: variableToFullName[variable1] + " [" + units[variable1] + "]",  // Example label
        yLabel: variableToFullName[variable2] + " [" + units[variable2] + "]",  // Example label
        pointColor: "#17a2b8"
    };

    const config = { ...defaultOptions };
    const { width, height, margin, xLabel, yLabel, pointColor } = config;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Remove any previous chart content
    d3.select("#comparisonGraph").selectAll("*").remove();

    // Create the SVG element for the scatterplot
    const svg = d3.select("#comparisonGraph")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Set up the X scale and axis based on the range of the first variable
   
    const x = d3.scaleLinear()
        .domain([d3.min(plotData, d => d.x), d3.max(plotData, d => d.x)])  // x-axis: variable1
        .range([0, innerWidth]);


    // Set up the Y scale and axis based on the range of the second variable
    const y = d3.scaleLinear()
        .domain([d3.min(plotData, d => d.y), d3.max(plotData, d => d.y)])  // y-axis: variable2
        .range([innerHeight, 0]);

    
    
    // Add circles for the scatter plot points
    svg.append('g')
        .selectAll("dot")
        .data(plotData)
        .enter()
        .append("circle")
        .attr("cx", function (d) { return x(d.x); })  // x position based on variable1
        .attr("cy", function (d) { return y(d.y); })  // y position based on variable2
        .attr("r", 5)  // Radius of the circles
        .style("fill", pointColor)
        .on("mouseover", function(event, d){
            {
                const val1 = d.x;
                const val2 = d.y;
                const date = d.d;
                
                let tooltip = d3.select("#tooltip");
                if (tooltip.empty()) {
                    tooltip = d3.select("body")
                        .append("div")
                        .attr("id", "tooltip")
                        .style("position", "absolute")
                        .style("padding", "5px 10px")
                        .style("background-color", "rgba(0, 0, 0, 0.7)")
                        .style("color", "white")
                        .style("border-radius", "5px")
                        .style("font-size", "14px")
                        .style("visibility", "hidden");
                }
        
            // Set the tooltip content
            tooltip
                .html(`Date: ${date.toLocaleDateString()} <br> ${variableToFullName[variable1]}: ${val1} ${units[variable1]} <br> ${variableToFullName[variable2]}: ${val2} ${units[variable2]}`)
                .style("visibility", "visible")
                .style("left", (event.pageX + 10) + "px")  // Offset for better visibility
                .style("top", (event.pageY - 30) + "px");  // Offset for better visibility
            }
        });

    // Add Y axis to the plot
    svg.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("font-size", "14px");
        
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -margin.left/2)
        .attr("text-anchor", "middle")
        .style("font-size", "25px")
        .text(yLabel);
    
    svg.append("g")
        .attr("transform", "translate(0," + innerHeight + ")")
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("font-size", "14px");
    svg
        .append("text")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${innerWidth / 2}, ${height - margin.bottom})`)
        .style("font-size", "25px")  // Increase font size
        .text(xLabel);


    // Add mouseout event to hide the tooltip when the mouse leaves the circle
    svg.selectAll("circle")
        .on("mouseout", function() {
            d3.select("#tooltip").style("visibility", "hidden");
        });
}


export function createTwoLineChart(data, station1, station2, variable) {

    // Process the data to prepare it for plotting
    const plotData = data[variable]
        .map((e) => {
            if (!isNaN(e[station1]) && !isNaN(e[station2])) {
                return {
                    date: new Date(e.date),
                    [station1]: +e[station1],
                    [station2]: +e[station2],
                };
            }
            return null;
        })
        .filter((d) => d !== null);

    // Transform data into a grouped format for multi-line plotting
    const groupedData = [
        {
            key: station1,
            values: plotData.map((d) => ({ date: d.date, value: d[station1] })),
        },
        {
            key: station2,
            values: plotData.map((d) => ({ date: d.date, value: d[station2] })),
        },
    ];

    // Set the dimensions and margins of the graph
    const graphContainer = document.getElementById("comparisonGraph");
    const containerWidth = graphContainer.offsetWidth;

    const margin = { top: 50, right: 50, bottom: 125, left: 75 };
    const width = containerWidth;
    const height = 800;
    const innerHeight = height - margin.top - margin.bottom;
    const innerWidth = width - margin.left - margin.right;

    // Clear previous graph content
    d3.select("#comparisonGraph").selectAll("*").remove();

    // Append the SVG object to the graph container
    const svg = d3
        .select("#comparisonGraph")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const mainGroup = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Define a clipping path to restrict drawing to the chart area
    svg.append("defs")
        .append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("x", 0)
        .attr("y", 0);

    

    // Scales and axes
    const x = d3
        .scaleTime()
        .domain(d3.extent(plotData, (d) => d.date))
        .range([0, innerWidth]);

    const xAxis = d3.axisBottom(x).ticks(5);
    const xAxisGroup = mainGroup
        .append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(xAxis);

    
    xAxisGroup.selectAll("text")
        .style("font-size", "14px");

    const y = d3
        .scaleLinear()
        .domain([
            d3.min(plotData, (d) => Math.min(d[station1], d[station2])),
            d3.max(plotData, (d) => Math.max(d[station1], d[station2])),
        ])
        .range([innerHeight, 0]);

    const yAxis = d3.axisLeft(y);
    const yAxisGroup = mainGroup.append("g").call(yAxis);
    yAxisGroup.selectAll("text")
        .style("font-size", "14px");

    // Color palette for the lines
    const color = d3
        .scaleOrdinal()
        .domain(groupedData.map((d) => d.key))
        .range(["#17a2b8", "#b82d17"]);

    // Draw the lines inside the clip
    const linesGroup = mainGroup
        .append("g")
        .attr("clip-path", "url(#clip)");

    const line = d3
        .line()
        .x((d) => x(d.date))
        .y((d) => y(d.value))
        .defined((d) => d.value !== null); // Ensures lines are clipped at the boundaries

    linesGroup
        .selectAll(".line")
        .data(groupedData)
        .enter()
        .append("path")
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", (d) => color(d.key))
        .attr("stroke-width", 1.5)
        .attr("d", (d) => line(d.values));

    // Zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 25]) // Zoom limits
        .translateExtent([[0, 0], [innerWidth, innerHeight]]) // Panning limits
        .on("zoom", zoomed);

    svg.call(zoom);

    // Tooltip text area
    const tooltip = svg
        .append("g")
        .style("opacity", 0)
        .style("pointer-events", "none")
        .attr("transform", `translate(${margin.left+100},${innerHeight + 120})`);

    tooltip
        .append("text")
        .attr("x", 15)
        .attr("y", -10)
        .attr("class", "tooltip-date")
        .style("font-size", "20px")
        .style("font-weight", "bold");

    tooltip
        .append("text")
        .attr("x", 15)
        .attr("y", 20)
        .attr("class", "tooltip-value1")
        .style("font-size", "20px");

    tooltip
        .append("text")
        .attr("x", 15)
        .attr("y", 40)
        .attr("class", "tooltip-value2")
        .style("font-size", "20px");

    // Cursor Line
    const cursorLine = svg
        .append("line")
        .style("stroke", "#000")
        .style("stroke-width", 1)
        .style("opacity", 0);

    // Add events for the cursor
    svg
        .append("rect")
        .style("fill", "none")
        .style("pointer-events", "all")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("x", margin.left)
        .attr("y", margin.top)
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseout", mouseout);

    let currentX = x;

    // Handle mouse events
    function mouseover() {
        tooltip.style("opacity", 1);
        cursorLine.style("opacity", 1);
    }
    
    function mousemove(event) {
        const [mouseX] = d3.pointer(event, mainGroup.node()); // Get mouse's x-coordinate
        const mouseDate = currentX.invert(mouseX); // Get date from rescaled x-axis

        const bisect = d3.bisector((d) => d.date).left;
        const i1 = bisect(groupedData[0].values, mouseDate, 1);
        const i2 = bisect(groupedData[1].values, mouseDate, 1);
    
        const d1 = groupedData[0].values[i1 - 1];
        const d2 = groupedData[1].values[i2 - 1];
    
        if (d1 && d2) {
            const cursorX = currentX(d1.date);
    
            cursorLine
                .attr("x1", cursorX + margin.left)
                .attr("x2", cursorX + margin.left)
                .attr("y1", 0)
                .attr("y2", innerHeight + margin.bottom);
    
            tooltip
                .select(".tooltip-date")
                .text(`Date: ${d1.date.toLocaleDateString()}`);
            tooltip
                .select(".tooltip-value1")
                .text(`${station1}: ${d1.value.toFixed(2)} ${units[variable]}`);
            tooltip
                .select(".tooltip-value2")
                .text(`${station2}: ${d2.value.toFixed(2)} ${units[variable]}`);
        }
    }
    
    function mouseout() {
        tooltip.style("opacity", 0);
        cursorLine.style("opacity", 0);
    }
    
    // Zoom behavior callback
    function zoomed(event) {
        const transform = event.transform;
        const newX = transform.rescaleX(x); // Rescale the x-axis
        currentX = newX; // Update the current x-scale
        xAxisGroup.call(xAxis.scale(newX)); // Update the x-axis
    
        // Update lines with the new scales
        const updatedLine = d3
            .line()
            .x((d) => newX(d.date))
            .y((d) => y(d.value))
            .defined((d) => d.value !== null);
    
        linesGroup.selectAll(".line").attr("d", (d) => updatedLine(d.values));
        xAxisGroup.selectAll("text").style("font-size", "14px");
    }

    // Add legend
    const legend = svg
        .selectAll(".legend")
        .data(groupedData)
        .enter()
        .append("g")
        .attr("transform", (_, i) => `translate(${margin.left},${innerHeight + 100 + i * 25})`);

    legend
        .append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .style("fill", (d) => color(d.key));

    legend
        .append("text")
        .attr("x", 20)
        .attr("y", 12)
        .text((d) => d.key)
        .style("font-size", "25px")
        .attr("alignment-baseline", "middle");

    svg.append("text")
        .attr("transform", "rotate(-90)") 
        .attr("x", -margin.top - innerHeight / 2)   
        .attr("y", margin.left / 2)   
        .attr("text-anchor", "middle")  
        .style("font-size", "25px")
        .text(variableToFullName[variable] + " [" + units[variable] + "]");
    
    svg.append("text")
        .attr("x", margin.left + innerWidth / 2) 
        .attr("y", innerHeight + margin.bottom - 40)
        .attr("text-anchor", "middle")
        .style("font-size", "25px")
        .text("Date");
}






