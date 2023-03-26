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
  Toast,
  Frame,
  List,
} from "@shopify/polaris";

import { TitleBar } from "@shopify/app-bridge-react";

import ChoroplethMap from "../components/ChoroplethMap";

import { useAuthenticatedFetch } from "../hooks";
import { Canvg, presets } from "canvg";

const UNEXPECTED_ERROR_MESSAGE =
  "We are really sorry. Something unexpected has gone wrong whilst updating your map. Please try again.";

const CANCELLED_MESSAGE = "Your update has been cancelled.";

const CANCEL_CONFIRM_MESSAGE =
  "Please wait a moment whilst your update cancellation is confirmed.";

const ALREADY_COMPLETED_MESSAGE =
  "Your update cannot be cancelled as it has already been completed.";

const CANCEL_FAILED_MESSAGE =
  "We have been unable to cancel your update, please try again.";

export default function Heatmap() {
  const mapContainerRef = useRef();
  const canvasRef = useRef();
  const fetch = useAuthenticatedFetch();
  const preset = presets.offscreen();

  const defaultProjection = d3.geoAlbers().rotate([0, 0]);

  const [operationId, setOperationId] = useState(null);
  const [cancelStatus, setCancelStatus] = useState({
    isError: false,
    show: false,
    message: "",
  });
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
    setOperationId(null);

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
      setError(UNEXPECTED_ERROR_MESSAGE);
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
          throw Error(UNEXPECTED_ERROR_MESSAGE);
        } else if (jsonResponse.data.node.status === "CANCELLED") {
          clearTimeout(timer);
          throw Error(CANCELLED_MESSAGE);
        } else {
          timer = setTimeout(poll, 10000);
        }
      } catch ({ message }) {
        setError(message);
        setIsLoading(false);
      }
    };

    poll();
  };

  const cancelBulkOperation = async () => {
    try {
      const response = await fetch("/api/cancel-bulk-operation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: operationId,
        }),
      });
      const jsonResponse = await response.json();

      if (
        jsonResponse.data.bulkOperationCancel.bulkOperation.status ===
        "CANCELED"
      ) {
        setIsLoading(false);
        setOperationId(null);
        setCancelStatus({
          show: true,
          isError: false,
          message: CANCEL_CONFIRM_MESSAGE,
        });
      } else if (
        jsonResponse.data.bulkOperationCancel.bulkOperation.status ===
        "COMPLETED"
      ) {
        throw Error(ALREADY_COMPLETED_MESSAGE);
      } else {
        throw Error(CANCEL_FAILED_MESSAGE);
      }
    } catch ({ message }) {
      console.error(message);
      setCancelStatus({
        show: true,
        isError: true,
        message,
      });
    }
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

    try {
      await fetchMapData();

      const { after, before } = calculateDateRange();

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

      setOperationId(bulkOperationId);

      checkBulkOperation(
        jsonResponse.data.bulkOperationRunQuery.bulkOperation.id
      );
    } catch ({ message }) {
      console.error(message);
      setError(UNEXPECTED_ERROR_MESSAGE);
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

  const downloadImage = async () => {
    const svg = document.getElementById("uk-map-hidden");
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const v = Canvg.fromString(ctx, svg.outerHTML, preset);

    await v.render();

    canvas.toBlob((blob) => {
      const pngUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = "map";
      link.click();
    });
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
    <Frame>
      <Page>
        {cancelStatus.show ? (
          <Toast
            onDismiss={() =>
              setCancelStatus({ show: false, isError: false, message: "" })
            }
            content={cancelStatus.message}
            error={cancelStatus.isError}
            duration={1000}
          />
        ) : null}
        <TitleBar
          title="Configure a Map"
          primaryAction={{
            content: "Download Map PNG",
            onAction: downloadImage,
            disabled: isLoading,
          }}
        />
        <Layout>
          {error && (
            <Layout.Section>
              <Banner
                title="Your update has not completed."
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
                  geographic boundries within a given date range and identify
                  your highest and lowest performing provinces.
                </p>
              </Card.Section>
              <Card.Section>
                <List type="bullet">
                  <List.Item>
                    You can click on a certain boundry (e.g. a province or
                    state) to view the number of orders for that specific
                    boundry.
                  </List.Item>
                  <List.Item>
                    Zoom in on the map by either double clicking or using the
                    mouse wheel. The map can also be dragged using the mouse.
                  </List.Item>
                  <List.Item>
                    Download an image of your map by clicking the download
                    button in the top right.
                  </List.Item>
                  <List.Item>
                    This app does not store any customer order data. It only
                    aggregates orders by zip code.
                  </List.Item>
                </List>
              </Card.Section>
              <Card.Section>
                <FormLayout>
                  <FormLayout.Group>
                    <Select
                      label="Map type"
                      options={mapOptions}
                      onChange={setMapType}
                      value={mapType}
                      disabled={isLoading}
                    />
                    <Select
                      label="Orders by date range"
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
              {isLoading && operationId && (
                <Card.Section>
                  <Banner
                    title="Your map is being updated. This may take a moment. Please do not leave the page until the update has completed or been cancelled."
                    action={{
                      content: "Cancel Update",
                      onAction: cancelBulkOperation,
                    }}
                    status="info"
                  >
                    <p>{error}</p>
                  </Banner>
                </Card.Section>
              )}
            </Card>
          </Layout.Section>
          <Layout.Section>
            <Card title={`Order Density by ${mapTitle}`} sectioned>
              <Card.Section>
                <div ref={mapContainerRef}>
                  <>
                    {isLoading ? <Spinner size="small" /> : null}
                    <ChoroplethMap
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
      <canvas
        width="1000px"
        height="1000px"
        style={{ position: "fixed", left: "-999999999px" }}
        ref={canvasRef}
      />
    </Frame>
  );
}
