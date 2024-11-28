import { StatusBar, Style } from "@capacitor/status-bar";
import "./dashboard.scss";
import "./styles.scss";

async function setup() {
	await StatusBar.setOverlaysWebView({ overlay: true });
	await StatusBar.setBackgroundColor({ color: "#ffffff" });
	await StatusBar.setStyle({ style: Style.Light });


}

setup();
