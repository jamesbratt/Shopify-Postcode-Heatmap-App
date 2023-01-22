import * as topojson from "topojson-client";
import * as d3 from "d3";

import { useAppQuery } from "../hooks";

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

const generatePaths = (data, path, colorScale, postcodeData) => {
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

const generateMap = (data, postcodeData, colour, imageSize) => {
  const colourSchemes = {
    GREEN: d3.schemeGreens,
    BLUE: d3.schemeBlues,
    RED: d3.schemeReds,
    ORANGE: d3.schemeOranges,
    PURPLE: d3.schemePurples,
    GREY: d3.schemeGreys,
  };

  const projection = d3.geoAlbers();

  const countiesJson = topojson.feature(data, data.objects["geojson"]);

  projection
    .rotate([0, 0])
    .fitSize(
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
    postcodeData
  );

  const legend = generateLegend(domainValues, colorScale, imageSize.height);

  return (
    <>
      <g>{legend}</g>
      <g>{draw}</g>
    </>
  );
};

const UkPostcodeMap = ({ getMapDimensions }) => {
  const { data: geoJson } = useAppQuery({
    url: "/api/map-data",
  });

  return (
    <div className="map">
      <div className="map-inner">
        {geoJson ? (
          <svg
            width={`${getMapDimensions().width}px`}
            height={`${getMapDimensions().height}px`}
            className="map-canvas"
            id="uk-map"
          >
            {generateMap(geoJson, null, "GREEN", getMapDimensions())}
          </svg>
        ) : null}
      </div>
    </div>
  );
};

export default UkPostcodeMap;
