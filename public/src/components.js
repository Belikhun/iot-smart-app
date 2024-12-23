
class GaugeComponent {
	constructor({
		width = 160,
		startAngle = -205,
		endAngle = 25,
		arcWidth = 8,
		shift = 22,
		minValue = 0,
		maxValue = 100,
		dangerousValue = null,
		square = false,
		labelDistBottom = 0,
		labelDistEdge = "1.5rem",
		unit = null
	} = {}) {
		this.id = randString(8);
		this.initialized = false;

		this.gauge = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		this.gauge.classList.add("gauge-arc");
		this.gauge.style.setProperty("--arc-width", `${arcWidth}px`);

		this.svgBackground = document.createElementNS("http://www.w3.org/2000/svg", "path");
		this.svgBackground.classList.add("background");

		this.svgValue = document.createElementNS("http://www.w3.org/2000/svg", "path");
		this.svgValue.classList.add("value");

		this.gauge.append(this.svgBackground, this.svgValue);

		this.container = makeTree("div", "gauge-component", {
			gauge: this.gauge,
			value: { tag: "div", class: "value", child: {
				current: { tag: "div", class: "current", text: "---" },
				unit: { tag: "div", class: "unit", text: unit }
			}},

			min: { tag: "span", class: "min-value", text: minValue },
			max: { tag: "span", class: "max-value", text: maxValue },
			hand: { tag: "div", class: "hand" }
		});

		this.width = width;
		this.startAngle = startAngle;
		this.endAngle = endAngle;
		this.currentValue = 0;
		this.minValue = minValue;
		this.maxValue = maxValue;
		this.dangerousValue = dangerousValue;

		if (typeof labelDistBottom === "number")
			labelDistBottom += "px";

		if (typeof labelDistEdge === "number")
			labelDistEdge += "px";

		this.container.style.setProperty("--label-dist-bottom", labelDistBottom);
		this.container.style.setProperty("--label-dist-edge", labelDistEdge);
		this.container.style.setProperty("--arc-width", `${arcWidth}px`);

		if (square) {
			this.height = this.width;
			this.centerX = this.width / 2;
			this.centerY = this.height / 2;
			this.radius = (this.width - arcWidth) / 2;
		} else {
			const theta = Math.abs(this.endAngle - this.startAngle);
			const radius = (this.width + arcWidth) / (2 * Math.sin(theta / 2));
			this.height = radius * (1 - Math.cos(theta / 2));

			this.centerX = this.width / 2;
			this.centerY = (this.height / 2) + shift;
			this.radius = (this.width - arcWidth) / 2;
		}

		this.gauge.setAttribute("width", this.width);
		this.gauge.setAttribute("height", this.height);
		this.gauge.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
		this.container.style.setProperty("--center-x", `${this.centerX}px`);
		this.container.style.setProperty("--center-y", `${this.centerY}px`);
		this.container.style.setProperty("--radius", `${this.radius}px`);

		this.drawBackground();

		if (this.dangerousValue)
			this.drawDangerousZone();

		this.value = 0;
		this.initialized = true;
	}

	set unit(/** @type {string} */ unit) {
		if (unit) {
			this.container.value.unit.innerText = unit;
			this.container.value.unit.style.display = null;
		} else {
			this.container.value.unit.style.display = "none";
		}
	}

	drawBackground() {
		const startAngle = this.startAngle * (Math.PI / 180);
		const endAngle = this.endAngle * (Math.PI / 180);

		const startX = this.centerX + this.radius * Math.cos(startAngle);
		const startY = this.centerY + this.radius * Math.sin(startAngle);
		const endX = this.centerX + this.radius * Math.cos(endAngle);
		const endY = this.centerY + this.radius * Math.sin(endAngle);

		const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";

		const pathData = [
			`M ${startX} ${startY}`,
			`A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
		].join(" ");

		this.svgBackground.setAttribute("d", pathData);
	}

	drawDangerousZone() {
		if (!this.dangerZone) {
			this.dangerZone = document.createElementNS("http://www.w3.org/2000/svg", "path");
			this.dangerZone.classList.add("dangerous");
		}

		if (!this.dangerousValue) {
			if (this.gauge.contains(this.dangerZone))
				this.gauge.removeChild(this.dangerZone);

			return;
		}

		const startP = scaleValue(this.dangerousValue, [this.minValue, this.maxValue], [0, 1]);
		const startAngle = (this.startAngle + (startP * (this.endAngle - this.startAngle))) * (Math.PI / 180);
		const startX = this.centerX + this.radius * Math.cos(startAngle);
		const startY = this.centerY + this.radius * Math.sin(startAngle);

		const endAngle = this.endAngle * (Math.PI / 180);
		const endX = this.centerX + this.radius * Math.cos(endAngle);
		const endY = this.centerY + this.radius * Math.sin(endAngle);

		const largeArcFlag = (endAngle - startAngle <= Math.PI) ? "0" : "1";

		const pathData = [
			`M ${startX} ${startY}`,
			`A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
		].join(" ");

		this.dangerZone.setAttribute("d", pathData);
		this.gauge.insertBefore(this.dangerZone, this.svgValue);
	}

	/**
	 * Set value
	 *
	 * @param	{number}	value
	 */
	setValue(value) {
		if (value === this.currentValue && this.initialized)
			return this;

		this.currentValue = value;
		this.container.value.current.innerText = this.currentValue;
		this.container.classList.toggle("dangerous", this.currentValue >= this.dangerousValue);
		const progress = scaleValue(this.currentValue, [this.minValue, this.maxValue], [0, 1]);

		const startAngle = this.startAngle * (Math.PI / 180);
		const startX = this.centerX + this.radius * Math.cos(startAngle);
		const startY = this.centerY + this.radius * Math.sin(startAngle);

		const angle = this.startAngle + (progress * (this.endAngle - this.startAngle));
		const endAngle = angle * (Math.PI / 180);
		const endX = this.centerX + this.radius * Math.cos(endAngle);
		const endY = this.centerY + this.radius * Math.sin(endAngle);

		const largeArcFlag = (endAngle - startAngle <= Math.PI) ? "0" : "1";

		const pathData = [
			`M ${startX} ${startY}`,
			`A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
		].join(" ");

		this.svgValue.setAttribute("d", pathData);
		this.container.hand.style.setProperty("--rotation", `${angle + 90}deg`);
		return this;
	}

	set value(value) {
		this.setValue(value);
	}

	get value() {
		return this.currentValue;
	}
}

class KnobComponent {
	constructor({
		width = 160,
		startAngle = -205,
		endAngle = 25,
		defaultAngle = undefined,
		arcWidth = 8,
		shift = 22,
		knobSpacing = 32,
		dragDistance = 400,
		square = false,
		lineDistEdge = 30
	} = {}) {
		this.id = randString(8);
		this.initialized = false;

		this.gauge = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		this.gauge.classList.add("knob-arc");
		this.gauge.style.setProperty("--arc-width", `${arcWidth}px`);

		this.svgBackground = document.createElementNS("http://www.w3.org/2000/svg", "path");
		this.svgBackground.classList.add("background");

		this.svgValue = document.createElementNS("http://www.w3.org/2000/svg", "path");
		this.svgValue.classList.add("value");

		this.gauge.append(this.svgBackground, this.svgValue);

		this.thumb = document.createElement("div");
		this.thumb.classList.add("thumb");
		this.thumb.style.width = this.thumb.style.height = `${width - arcWidth - knobSpacing}px`;

		this.valueNode = document.createElement("div");
		this.valueNode.classList.add("value");

		this.container = makeTree("div", "rotate-knob-component", {
			gauge: this.gauge,
			thumb: this.thumb,
			value: this.valueNode
		});

		this.width = width;
		this.startAngle = startAngle;
		this.endAngle = endAngle;
		this.currentValue = 0;
		this.inputHandlers = [];
		this.valueClamp = [0, 1];

		if (typeof defaultAngle !== "number")
			defaultAngle = this.startAngle;

		this.defaultAngle = defaultAngle;

		if (this.defaultAngle > this.startAngle)
			this.valueClamp = [-1, 1];

		if (typeof lineDistEdge === "number")
			lineDistEdge += "px";

		this.container.style.setProperty("--line-dist-edge", lineDistEdge);
		this.container.style.setProperty("--arc-width", `${arcWidth}px`);

		if (square) {
			this.height = this.width;
			this.centerX = this.width / 2;
			this.centerY = this.height / 2;
			this.radius = (this.width - arcWidth) / 2;
			this.container.classList.add("square");
		} else {
			const theta = Math.abs(this.endAngle - this.startAngle);
			const radius = (this.width + arcWidth) / (2 * Math.sin(theta / 2));
			this.height = radius * (1 - Math.cos(theta / 2));

			this.centerX = this.width / 2;
			this.centerY = (this.height / 2) + shift;
			this.radius = (this.width - arcWidth) / 2;
		}

		this.gauge.setAttribute("width", this.width);
		this.gauge.setAttribute("height", this.height);
		this.gauge.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
		this.container.style.setProperty("--center-x", `${this.centerX}px`);
		this.container.style.setProperty("--center-y", `${this.centerY}px`);

		let mouseDownPoint = null;
		let mouseDownValue = null;

		const handleMouseMove = (/** @type {MouseEvent} */ e) => {
			const distance = mouseDownPoint[1] - e.clientY;
			const value = mouseDownValue + (distance / dragDistance);
			const newValue = round(Math.max(this.valueClamp[0], Math.min(this.valueClamp[1], value)), 2);
			this.setValue(newValue, "user");
		};

		const handleMouseUp = (/** @type {MouseEvent} */ e) => {
			app.root.removeEventListener("mousemove", handleMouseMove);
			app.root.removeEventListener("mouseup", handleMouseUp);
			this.container.classList.remove("dragging");
		}

		this.container.addEventListener("mousedown", (e) => {
			mouseDownPoint = [e.clientX, e.clientY];
			mouseDownValue = this.value;
			this.container.classList.add("dragging");
			app.root.addEventListener("mousemove", handleMouseMove);
			app.root.addEventListener("mouseup", handleMouseUp, { once: true });
		});


		const handleTouchMove = (/** @type {TouchEvent} */ e) => {
			e.preventDefault();
			const touch = e.changedTouches[0];

			const distance = mouseDownPoint[1] - touch.clientY;
			const value = mouseDownValue + (distance / (dragDistance * 2));
			const newValue = round(Math.max(this.valueClamp[0], Math.min(this.valueClamp[1], value)), 2);
			this.setValue(newValue, "user");
		};

		const handleTouchEnd = (/** @type {TouchEvent} */ e) => {
			app.root.removeEventListener("touchmove", handleTouchMove);
			app.root.removeEventListener("touchend", handleTouchEnd);
			this.container.classList.remove("dragging");
		}

		this.container.addEventListener("touchstart", (e) => {
			e.preventDefault();
			const touch = e.changedTouches[0];

			mouseDownPoint = [touch.clientX, touch.clientY];
			mouseDownValue = this.value;
			this.container.classList.add("dragging");
			app.root.addEventListener("touchmove", handleTouchMove);
			app.root.addEventListener("touchend", handleTouchEnd, { once: true });
		});

		this.drawBackground();

		this.value = 0;
		this.initialized = true;
	}

	drawBackground() {
		const startAngle = this.startAngle * (Math.PI / 180);
		const endAngle = this.endAngle * (Math.PI / 180);

		const startX = this.centerX + this.radius * Math.cos(startAngle);
		const startY = this.centerY + this.radius * Math.sin(startAngle);
		const endX = this.centerX + this.radius * Math.cos(endAngle);
		const endY = this.centerY + this.radius * Math.sin(endAngle);

		const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";

		const pathData = [
			`M ${startX} ${startY}`,
			`A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
		].join(" ");

		this.svgBackground.setAttribute("d", pathData);
	}

	/**
	 * Set value
	 *
	 * @param	{number}				value
	 * @param	{"user" | "internal"}	source
	 */
	setValue(value, source = "internal") {
		value = clamp(value, this.valueClamp[0], this.valueClamp[1]);

		if (value === this.currentValue && this.initialized)
			return this;

		this.currentValue = value;
		this.valueNode.innerText = `${Math.floor(value * 100)}%`;

		// const angle = scaleValue(value, [-1, 1], [this.startAngle, this.endAngle]);
		let angle = (value >= 0)
			? this.defaultAngle + (value * (this.endAngle - this.defaultAngle))
			: this.startAngle + ((1 - Math.abs(value)) * (this.defaultAngle - this.startAngle));

		angle = clamp(angle, this.startAngle, this.endAngle);

		if (angle >= this.defaultAngle) {
			const startAngle = this.defaultAngle * (Math.PI / 180);
			const startX = this.centerX + this.radius * Math.cos(startAngle);
			const startY = this.centerY + this.radius * Math.sin(startAngle);

			const endAngle = angle * (Math.PI / 180);
			const endX = this.centerX + this.radius * Math.cos(endAngle);
			const endY = this.centerY + this.radius * Math.sin(endAngle);

			const largeArcFlag = (endAngle - startAngle <= Math.PI) ? "0" : "1";

			const pathData = [
				`M ${startX} ${startY}`,
				`A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
			].join(" ");

			this.svgValue.setAttribute("d", pathData);
		} else {
			const startAngle = angle * (Math.PI / 180);
			const startX = this.centerX + this.radius * Math.cos(startAngle);
			const startY = this.centerY + this.radius * Math.sin(startAngle);

			const endAngle = this.defaultAngle * (Math.PI / 180);
			const endX = this.centerX + this.radius * Math.cos(endAngle);
			const endY = this.centerY + this.radius * Math.sin(endAngle);

			const largeArcFlag = (endAngle - startAngle <= Math.PI) ? "0" : "1";

			const pathData = [
				`M ${startX} ${startY}`,
				`A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
			].join(" ");

			this.svgValue.setAttribute("d", pathData);
		}

		this.thumb.style.setProperty("--rotation", `${angle + 90}deg`);

		if (source === "user") {
			for (const handler of this.inputHandlers) {
				try {
					handler(this.value);
				} catch (e) {
					clog("WARN", `KnobComponent(): an error occured while handing input handler:`, e);
					continue;
				}
			}
		}

		return this;
	}

	/**
	 * Handle input value change.
	 *
	 * @param	{(value: number) => void}	handler
	 */
	onInput(handler) {
		this.inputHandlers.push(handler);
		return this;
	}

	set value(value) {
		this.setValue(value, "internal");
	}

	get value() {
		return this.currentValue;
	}
}

class SystemNotificationForm {
	constructor() {
		this.levelSelect = createSelectInput({
			label: "Cấp độ",
			fixed: false,
			options: {
				info: "Thông tin",
				warning: "Cảnh báo",
				critical: "Nghiêm trọng"
			},

			value: "info"
		});

		this.contentInput = createInput({
			type: "text",
			label: "Nội dung"
		});

		this.submitButton = createButton("", {
			icon: "paperPlaneTop",
			disabled: true,
			onClick: async () => {
				for (const handler of this.inputHandlers) {
					try {
						await handler(this.value);
					} catch (e) {
						clog("WARN", e);
					}
				}
			}
		});

		this.levelSelect.onChange(() => this.updateState());
		this.contentInput.onInput(() => this.updateState());

		this.view = makeTree("div", "system-notification-form", {
			level: this.levelSelect,
			content: this.contentInput,
			submit: this.submitButton
		});

		this.inputHandlers = [];
	}

	set disabled(disabled) {
		this.levelSelect.disabled = disabled;
		this.contentInput.disabled = disabled;
	}

	set value(value) {
		if (!value) {
			this.levelSelect.value = "info";
			this.contentInput.value = null;
			this.updateState();
			return;
		}

		const { level, message } = value;
		this.levelSelect.value = level;
		this.contentInput.value = message;
		this.updateState();
	}

	get value() {
		return {
			level: this.levelSelect.value,
			message: this.contentInput.value
		};
	}

	updateState() {
		this.submitButton.disabled = (!this.levelSelect.value || !this.contentInput.value);
		return this;
	}

	/**
	 * Listen for on input event.
	 *
	 * @param	{(value: { level: string, message: string }) => void}	handler
	 * @returns	{this}
	 */
	onInput(handler) {
		this.inputHandlers.push(handler);
		return this;
	}
}
