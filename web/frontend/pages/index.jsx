import React, { useState, useRef } from "react";

import {
  Card,
  Page,
  Layout,
  TextContainer,
  Image,
  Stack,
  Link,
  Heading,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { trophyImage } from "../assets";

import { ProductsCard } from "../components";

import { Canvg, presets } from "canvg";

import * as topojson from "topojson-client";

import * as d3 from "d3";

import { useAppQuery, useAuthenticatedFetch } from "../hooks";

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

export default function HomePage() {
  const [isMapLoading, setIsMapLoading] = useState(true);

  const { data, isLoading } = useAppQuery({
    url: "/api/map-data",
    reactQueryOptions: {
      onSuccess: () => {
        setIsMapLoading(false);
      },
    },
  });

  const [geoJson, setGeoJson] = useState(null);
  const [postcodeData, setPostcodeData] = useState(null);
  const [colour, setColour] = useState("GREEN");

  const canvasRef = useRef();
  const columnNameInputRef = useRef();

  const preset = presets.offscreen();

  const element = document.getElementById("app");
  const positionInfo = element.getBoundingClientRect();
  const height = positionInfo.height - 100;
  const width = positionInfo.width / 2 - 100;

  const imageSize = {
    width,
    height,
  };

  const props = {
    width: "1000px",
    height: "1000px",
    style: { position: "absolute", left: "-999999999px" },
  };

  return (
    <Page narrowWidth>
      <TitleBar title="UK Customer Heatmap" primaryAction={null} />
      <Layout>
        <Layout.Section>
          <div className="app-container">
            <div className="map">
              <div className="map-inner">
                {geoJson ? (
                  <svg
                    width={`${width}px`}
                    height={`${height}px`}
                    className="map-canvas"
                    id="uk-map"
                  >
                    {generateMap(geoJson, postcodeData, colour, imageSize)}
                  </svg>
                ) : null}
                {geoJson ? (
                  <svg
                    {...props}
                    className="map-canvas"
                    xmlns="http://www.w3.org/2000/svg"
                    id="uk-map-hidden"
                  >
                    {generateMap(geoJson, postcodeData, colour, {
                      width: 1000,
                      height: 1000,
                    })}
                  </svg>
                ) : null}
              </div>
            </div>
            <canvas {...props} ref={canvasRef} />
          </div>
        </Layout.Section>
        <Layout.Section>
          <ProductsCard />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
