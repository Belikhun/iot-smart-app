import { StatusBar, Style } from "@capacitor/status-bar";
import { PushNotifications } from "@capacitor/push-notifications";
import { FCM } from "@capacitor-community/fcm";
import "./dashboard.scss";
import "./styles.scss";

function setup() {
	setupStatusBar();
	setupNotification();
}

async function setupStatusBar() {
	await StatusBar.setOverlaysWebView({ overlay: true });
	// await StatusBar.setBackgroundColor({ color: "#ffffff" });
	await StatusBar.setStyle({ style: Style.Light });
}

async function setupNotification() {
	const permStatus = await PushNotifications.checkPermissions();

	if (permStatus.receive === "prompt")
		permStatus = await PushNotifications.requestPermissions();

	if (permStatus.receive !== "granted")
		throw new Error("User denied permissions!");

	PushNotifications.addListener("registration", (token) => {
		console.log("Push registration success, token: " + token.value);
	});

	PushNotifications.addListener("registrationError", (error) => {
		console.warn("Error on registration: ", error);
	});

	PushNotifications.addListener("pushNotificationReceived", (notification) => {
		console.log("Push received: ", notification);
	});

	PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
		console.log("Push action performed: ", notification);
	});

	await PushNotifications.register();

	await PushNotifications.createChannel({
		id: "system-alert",
		name: "Cảnh báo",
		description: "Nhận thông báo cảnh báo từ hệ thống khi được kích hoạt.",
		importance: 5,
		vibration: true
	});

	FCM.subscribeTo({ topic: "mobile" })
		.then((result) => console.log("Subscribed to ", result))
		.catch((error) => console.warn("FCM subscribing errored: ", error));
}

window.setStatusBarStyle = async (style) => {
	await StatusBar.setStyle({ style });
}

setup();
