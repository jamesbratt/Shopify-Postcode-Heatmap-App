import React, { useRef, useState } from "react";
import { formatISO, sub, startOfMonth } from "date-fns";

import {
  Card,
  Page,
  Layout,
  Select,
  Button,
  Spinner,
  Banner,
  FormLayout,
} from "@shopify/polaris";

import { TitleBar } from "@shopify/app-bridge-react";

import UkPostcodeMap from "./UkPostcodeMap";

import { useAuthenticatedFetch } from "../hooks";

const SERVER_ERROR_MESSAGE =
  "We are really sorry. Something unexpected has gone wrong retreiving your order data. Please try again.";

export default function Heatmap() {
  const mapContainerRef = useRef();
  const fetch = useAuthenticatedFetch();

  const [isLoading, setIsLoading] = useState(false);
  const [selection, setSelection] = useState({ area: "", value: "" });
  const [dateRange, setDateRange] = useState("today");
  const [colour, setColour] = useState("GREEN");
  const [error, setError] = useState(null);
  const [postcodeData, setPostcodeData] = useState(null);

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

  const onDateRangeChange = (range) => {
    setDateRange(range);
  };

  const onSelectArea = (area, value) => {
    setSelection({
      area: area === selection.area ? "" : area,
      value: area === selection.area ? "" : value,
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

  return (
    <>
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
        <Card title="UK Order Density by Postcode District" sectioned>
          <Card.Section>
            <div ref={mapContainerRef}>
              {isLoading ? (
                <Spinner accessibilityLabel="Spinner example" size="large" />
              ) : (
                <UkPostcodeMap
                  getMapDimensions={getMapDimensions}
                  postcodeData={postcodeData}
                  colour={colour}
                  setSelection={onSelectArea}
                />
              )}
            </div>
          </Card.Section>
          <Card.Section>
            <p>
              Postcode District: {selection.area} &nbsp; Number of orders:{" "}
              {selection.value}
            </p>
          </Card.Section>
        </Card>
      </Layout.Section>
      <Layout.Section secondary>
        <Card title="Generate Heatmap" sectioned>
          <FormLayout>
            <Select
              label="Orders"
              options={options}
              onChange={onDateRangeChange}
              value={dateRange}
            />
            <Button onClick={fetchData} primary>
              Generate Heatmap
            </Button>
          </FormLayout>
        </Card>
        <Card title="Export Heatmap" sectioned>
          <FormLayout>
            <Select
              label="Map Colour"
              options={colorOptions}
              onChange={setColour}
              value={colour}
            />
            <Button primary>Download .PNG Image</Button>
          </FormLayout>
        </Card>
      </Layout.Section>
    </>
  );
}
