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

const generatePaths = (data, path, colorScale, postcodeData, setSelection) => {
  return data.map((feature) => {
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
        strokeWidth="0.2"
        onClick={() =>
          setSelection(
            feature.properties.name,
            postcodeData && postcodeData[feature.properties.name]
              ? postcodeData[feature.properties.name]
              : 0
          )
        }
      />
    );
  });
};

const generateLegend = (data, colorScale, height) => {
  const scaleValues = data.reverse();
  return scaleValues.map((scaleValue, i) => {
    const fill = colorScale(scaleValue);
    const x = Math.floor(i / 10) * 20 + 200;
    const y = (i % 10) * 20 + height - 250;
    return (
      <g key={scaleValue}>
        <text fontSize={"12px"} x={Math.floor(i / 10) * 20 + 220} y={y + 12}>
          {`${
            i > 0 && i !== scaleValues.length - 1
              ? `${scaleValues[i + 1]} - `
              : ""
          }${scaleValue} ${i === 0 ? ">" : i === data.length - 1 ? "<" : ""}`}
        </text>
        <rect width={15} height={15} x={x} y={y} fill={fill} />
      </g>
    );
  });
};

const generateMap = (
  data,
  postcodeData,
  colour,
  imageSize,
  setSelection,
  projection
) => {
  const svg = d3.select("svg");
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
    setSelection
  );

  const legend = generateLegend(domainValues, colorScale, imageSize.height);

  return (
    <>
      {/* <g>{legend}</g> */}
      <g>{draw}</g>
    </>
  );
};

const UkPostcodeMap = ({
  getMapDimensions,
  postcodeData,
  colour,
  setSelection,
  geoJson,
  projection,
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
                projection
              )
            : null}
        </svg>
      </div>
    </div>
  );
};

export default UkPostcodeMap;
