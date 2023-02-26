import * as topojson from "topojson-client";
import * as d3 from "d3";

const DOMAIN_LENGTH = 6;

const generateDomainValues = (postcodeData) => {
  if (postcodeData) {
    const minValue = Math.min(...Object.values(postcodeData));
    const maxValue = Math.max(...Object.values(postcodeData));

    const incrementBy = Math.round(maxValue / 6);

    let domains = [];

    for (let i = 0; i < DOMAIN_LENGTH; i++) {
      if (i === 0) {
        domains.push(Math.round(minValue));
      } else {
        domains.push(domains[i - 1] + incrementBy);
      }
    }

    return domains;
  } else {
    return [];
  }
};

const generatePaths = (
  data,
  path,
  colorScale,
  postcodeData,
  setSelection,
  selection
) => {
  return data.map((feature) => {
    const strokeWidth =
      selection.area === feature.properties.name ? "1" : "0.2";
    const fill = postcodeData
      ? colorScale(postcodeData[feature.properties.name] ?? -1)
      : colorScale(12);
    return (
      <path
        key={feature.properties.objectid}
        className="path"
        d={path(feature)}
        fill={fill}
        stroke="black"
        strokeWidth={strokeWidth}
        style={{ cursor: "pointer" }}
        onClick={() =>
          setSelection(
            feature.properties.name,
            postcodeData && postcodeData[feature.properties.name]
              ? postcodeData[feature.properties.name]
              : 0,
            feature.properties.desc
          )
        }
      />
    );
  });
};

const generateMap = (
  data,
  postcodeData,
  colour,
  imageSize,
  setSelection,
  projection,
  selection
) => {
  const svg = d3.select("#uk-map");
  const zoom = d3
    .zoom()
    .scaleExtent([1, 8])
    .translateExtent([
      [0, 0],
      [imageSize.width, imageSize.height],
    ])
    .on("zoom", zoomed);

  function zoomed(event) {
    const g = d3.select("g");
    g.selectAll("path") // To prevent stroke width from scaling
      .attr("transform", event.transform);
  }

  svg.call(zoom);

  const colourSchemes = {
    GREEN: d3.schemeGreens,
    BLUE: d3.schemeBlues,
    RED: d3.schemeReds,
    ORANGE: d3.schemeOranges,
    PURPLE: d3.schemePurples,
    GREY: d3.schemeGreys,
  };

  const countiesJson = topojson.feature(data, data.objects["geojson"]);

  projection.fitSize(
    [parseInt(imageSize.width), parseInt(imageSize.height)],
    countiesJson
  );

  const path = d3.geoPath().projection(projection);

  const domainValues = generateDomainValues(postcodeData);
  const colorScale = d3
    .scaleThreshold()
    .domain(domainValues)
    .range(colourSchemes[colour][DOMAIN_LENGTH + 1]);

  const draw = generatePaths(
    countiesJson.features,
    path,
    colorScale,
    postcodeData,
    setSelection,
    selection
  );

  return (
    <>
      <g>{draw}</g>
    </>
  );
};

const ChoroplethMap = ({
  getMapDimensions,
  postcodeData,
  colour,
  setSelection,
  geoJson,
  projection,
  selection,
}) => {
  return (
    <div className="map">
      <div className="map-inner" style={{ position: "relative" }}>
        <svg
          width={`${getMapDimensions().width}px`}
          height={`${getMapDimensions().height}px`}
          className="map-canvas"
          id="uk-map"
        >
          {geoJson
            ? generateMap(
                geoJson,
                postcodeData,
                colour,
                getMapDimensions(),
                setSelection,
                projection,
                selection
              )
            : null}
        </svg>
        <svg
          width="1000px"
          height="1000px"
          style={{ position: "fixed", left: "-999999999px" }}
          className="map-canvas"
          id="uk-map-hidden"
        >
          {geoJson
            ? generateMap(
                geoJson,
                postcodeData,
                colour,
                { width: 1000, height: 1000 },
                setSelection,
                projection,
                selection
              )
            : null}
        </svg>
      </div>
    </div>
  );
};

export default ChoroplethMap;
