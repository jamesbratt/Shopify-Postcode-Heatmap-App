import React, { useEffect, useRef, useState } from "react";
import { formatISO, sub, startOfMonth } from "date-fns";
import * as d3 from "d3";

import {
  Card,
  Layout,
  Select,
  Spinner,
  Banner,
  FormLayout,
  Page,
  EmptyState,
  DescriptionList,
  Button,
} from "@shopify/polaris";

import { TitleBar } from "@shopify/app-bridge-react";

import UkPostcodeMap from "../components/UkPostcodeMap";

import { useAuthenticatedFetch } from "../hooks";

const SERVER_ERROR_MESSAGE =
  "We are really sorry. Something unexpected has gone wrong retreiving your order data. Please try again.";

export default function Heatmap() {
  const mapContainerRef = useRef();
  const fetch = useAuthenticatedFetch();

  const defaultProjection = d3.geoAlbers().rotate([0, 0]);

  const [isLoading, setIsLoading] = useState(false);
  const [selection, setSelection] = useState({ area: "", value: "", desc: "" });
  const [dateRange, setDateRange] = useState("today");
  const [colour, setColour] = useState("GREEN");
  const [mapType, setMapType] = useState("UK");
  const [mapTitle, setMapTitle] = useState("UK Postcode District");
  const [error, setError] = useState(null);
  const [postcodeData, setPostcodeData] = useState(null);
  const [boundries, setBoundries] = useState(null);
  const [projection, setProjection] = useState({ value: defaultProjection });

  const getMapDimensions = () => {
    return mapContainerRef.current
      ? {
          width: mapContainerRef.current.offsetWidth,
          height: mapContainerRef.current.offsetWidth,
        }
      : { width: 0, height: 0 };
  };

  const readFromStream = async (url) => {
    try {
      const response = await fetch("/api/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          mapType,
        }),
      });
      const jsonResponse = await response.json();
      setPostcodeData(jsonResponse);
      setIsLoading(false);
    } catch ({ message }) {
      console.error(message);
      setError(SERVER_ERROR_MESSAGE);
      setIsLoading(false);
    }
  };

  const checkBulkOperation = (bulkOperationId) => {
    let timer;
    const poll = async () => {
      try {
        const response = await fetch("/api/check-export-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: bulkOperationId,
          }),
        });
        const jsonResponse = await response.json();

        if (
          jsonResponse.data.node.status === "COMPLETED" &&
          jsonResponse.data.node.url
        ) {
          clearTimeout(timer);
          readFromStream(jsonResponse.data.node.url);
        } else if (
          jsonResponse.data.node.status === "COMPLETED" &&
          !jsonResponse.data.node.url
        ) {
          clearTimeout(timer);
          setPostcodeData(null);
          setIsLoading(false);
        } else if (jsonResponse.data.node.status === "FAILED") {
          clearTimeout(timer);
          setIsLoading(false);
          throw Error(SERVER_ERROR_MESSAGE);
        } else {
          timer = setTimeout(poll, 10000);
        }
      } catch ({ message }) {
        console.error(message);
        setError(SERVER_ERROR_MESSAGE);
        setIsLoading(false);
      }
    };

    poll();
  };

  const calculateDateRange = () => {
    switch (dateRange) {
      case "today": {
        return {
          after: formatISO(new Date().setHours(0, 0, 0, 0)),
          before: formatISO(new Date()),
        };
      }
      case "yesterday": {
        const after = sub(new Date().setHours(0, 0, 0, 0), {
          days: 1,
        });

        return {
          after: formatISO(after),
          before: formatISO(new Date().setHours(0, 0, 0, 0)),
        };
      }
      case "last24hours": {
        const after = sub(new Date(), {
          hours: 24,
        });

        return {
          after: formatISO(after),
          before: formatISO(new Date()),
        };
      }
      case "lastWeek": {
        const after = sub(new Date(), {
          weeks: 1,
        });

        return {
          after: formatISO(after),
          before: formatISO(new Date()),
        };
      }
      case "last30days": {
        const after = sub(new Date(), {
          days: 30,
        });

        return {
          after: formatISO(after),
          before: formatISO(new Date()),
        };
      }
      case "monthtodate": {
        const after = startOfMonth(new Date());

        return {
          after: formatISO(after),
          before: formatISO(new Date()),
        };
      }

      default:
        return { after: null, before: null };
    }
  };

  const fetchData = async () => {
    setError(null);
    setIsLoading(true);
    setPostcodeData(null);
    setSelection({ area: "", value: "", desc: "" });

    await fetchMapData();

    const { after, before } = calculateDateRange();

    try {
      const response = await fetch("/api/export-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          after,
          before,
        }),
      });
      const jsonResponse = await response.json();

      const bulkOperationId =
        jsonResponse?.data?.bulkOperationRunQuery?.bulkOperation?.id;

      if (!bulkOperationId) {
        throw Error("No bulk operation ID was created");
      }

      checkBulkOperation(
        jsonResponse.data.bulkOperationRunQuery.bulkOperation.id
      );
    } catch ({ message }) {
      console.error(message);
      setError(SERVER_ERROR_MESSAGE);
      setIsLoading(false);
    }
  };

  const fetchMapData = async () => {
    const response = await fetch("/api/map-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mapType,
      }),
    });

    const jsonResponse = await response.json();
    setBoundries(jsonResponse);

    const mapTypeTitle = {
      UK: "UK Postcode District",
      US: "US State",
    };

    setMapTitle(mapTypeTitle[mapType]);

    const projectionMap = {
      UK: d3.geoAlbers().rotate([0, 0]),
      US: d3.geoAlbersUsa(),
    };

    setProjection({ value: projectionMap[mapType] });
  };

  const onDateRangeChange = (range) => {
    setDateRange(range);
  };

  const onSelectArea = (area, value, desc) => {
    setSelection({
      area: area === selection.area ? "" : area,
      value: area === selection.area ? "" : value,
      desc: area === selection.area ? "" : desc,
    });
  };

  const options = [
    { label: "Todays Orders", value: "today" },
    { label: "Yesterdays Orders", value: "yesterday" },
    { label: "Orders in the last 24 hours", value: "last24hours" },
    { label: "Orders in the last 7 days", value: "lastWeek" },
    { label: "Orders in the last 30 days", value: "last30days" },
    { label: "Orders from month to date", value: "monthtodate" },
  ];

  const colorOptions = [
    { label: "Green", value: "GREEN" },
    { label: "Blue", value: "BLUE" },
    { label: "Red", value: "RED" },
    { label: "Orange", value: "ORANGE" },
    { label: "Purple", value: "PURPLE" },
    { label: "Grey", value: "GREY" },
  ];

  const mapOptions = [
    { label: "UK Postcode Districts", value: "UK" },
    { label: "US States", value: "US" },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const hasSelected = selection.area !== "";

  return (
    <Page>
      <TitleBar
        title="Customer Order Map"
        primaryAction={{
          content: "Download Map PNG",
          onAction: () => {},
          disabled: isLoading,
        }}
      />
      <Layout>
        {error && (
          <Layout.Section>
            <Banner
              title="We were unable to retrieve your order data"
              action={{ content: "Try Again", onAction: fetchData }}
              status="critical"
            >
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}
        <Layout.Section>
          <Card title="Get Started">
            <Card.Section>
              <p>
                Visualize the density of your customer orders for specific
                national geographic boundries within a given date range and
                identify your highest and lowest performing provinces.
              </p>
            </Card.Section>
            <Card.Section>
              <FormLayout>
                <FormLayout.Group>
                  <Select
                    label="Map boundries"
                    options={mapOptions}
                    onChange={setMapType}
                    value={mapType}
                    disabled={isLoading}
                  />
                  <Select
                    label="Customer Order Data"
                    options={options}
                    onChange={onDateRangeChange}
                    value={dateRange}
                    disabled={isLoading}
                  />
                </FormLayout.Group>
                <Button primary disabled={isLoading} onClick={fetchData}>
                  Update Map
                </Button>
              </FormLayout>
            </Card.Section>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card title={`Order Density by ${mapTitle}`} sectioned>
            <Card.Section>
              <div ref={mapContainerRef}>
                <>
                  {isLoading ? <Spinner size="small" /> : null}
                  <UkPostcodeMap
                    getMapDimensions={getMapDimensions}
                    postcodeData={postcodeData}
                    colour={colour}
                    setSelection={onSelectArea}
                    geoJson={boundries}
                    projection={projection.value}
                    selection={selection}
                  />
                </>
              </div>
            </Card.Section>
          </Card>
        </Layout.Section>
        <Layout.Section secondary>
          <Card title="Boundry Data" sectioned>
            {hasSelected ? (
              <DescriptionList
                spacing="tight"
                items={[
                  {
                    term: "Boundry Code",
                    description: selection.area,
                  },
                  {
                    term: "No. Orders",
                    description: selection.value,
                  },
                  {
                    term: "Boundry Name",
                    description: selection.desc,
                  },
                ]}
              />
            ) : (
              <EmptyState heading="Click on the map to select a boundry">
                <p>e.g. a postcode district or state/province</p>
              </EmptyState>
            )}
          </Card>

          <Card title="Configure Map Styling" sectioned>
            <FormLayout>
              <Select
                label="Colour"
                options={colorOptions}
                onChange={setColour}
                value={colour}
                disabled={isLoading}
              />
            </FormLayout>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
