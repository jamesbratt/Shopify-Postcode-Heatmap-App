import Heatmap from "../components/Heatmap";
import { Page, Layout } from "@shopify/polaris";

import { TitleBar } from "@shopify/app-bridge-react";

export default function UkHeatmap() {
  return (
    <Page>
      <TitleBar title="UK Postcode Districts" primaryAction={null} />
      <Layout>
        <Heatmap />
      </Layout>
    </Page>
  );
}
