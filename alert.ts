import { type Alert } from "@/types/alert";
import { retryRequest } from "@utils/axios";

export default async function alert(alert: Alert): Promise<void> {
  // add your custom alert code here!
  basicAlert(alert);
  // or
  // await pagerDutyAlert
}

function basicAlert(alert: Alert): void {
  console.log(alert);
}

export async function pagerDutyAlert(alert: Alert): Promise<void> {
  const data = {
    routing_key: "yourPagerDutyKeyHere",
    payload: {
      summary: `Whistleblower ${alert.type} alert`,
      severity: "error",
      source: "Whistleblower ",
      component: undefined,
      custom_details: {
        ...alert,
      },
    },
    event_action: "trigger",
  };

  await retryRequest("https://events.pagerduty.com/v2/enqueue", {
    data,
    method: "post",
    headers: { "content-type": "application/json" },
  }).catch((e) => console.error("Error posting alert to PD", e));
}
