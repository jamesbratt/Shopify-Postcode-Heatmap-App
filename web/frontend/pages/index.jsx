import React, { useRef } from "react";

import { Card, Page, Layout } from "@shopify/polaris";

import { TitleBar } from "@shopify/app-bridge-react";

import UkPostcodeMap from "../components/UkPostcodeMap";

export default function HomePage() {
  const mapContainerRef = useRef();

  const getMapDimensions = () => {
    return mapContainerRef.current
      ? {
          width: mapContainerRef.current.offsetWidth,
          height: mapContainerRef.current.offsetWidth,
        }
      : { width: 0, height: 0 };
  };

  return (
    <Page>
      <TitleBar title="UK Customer Heatmap" primaryAction={null} />
      <Layout>
        <Layout.Section>
          <Card title="UK Order Density by Postcode District" sectioned>
            <div ref={mapContainerRef}>
              <UkPostcodeMap getMapDimensions={getMapDimensions} />
            </div>
          </Card>
        </Layout.Section>
        <Layout.Section secondary>
          <Card title="Configure Heatmap" sectioned>
            <p>Foo bar fizz.</p>
          </Card>
          <Card title="Download Heatmap" sectioned>
            <p>Foo bar fizz.</p>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
