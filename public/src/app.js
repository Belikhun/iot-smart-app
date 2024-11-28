
DEBUG = true;

const app = {
	root: document.getElementById("app"),

	data: {},
	strings: {},

	/** @type {Session} */
	session: undefined,

	/** @type {User} */
	user: undefined,

	/** @type {LoadingOverlay} */
	loadingOverlay: undefined,

	/** @type {((size: "desktop"|"tablet"|"mobile") => void)[]} */
	screenModeChangeListeners: [],

	currentScreenMode: null,

	/** @type {?ContextMenu} */
	currentContextMenu: null,

	baseUrl: null,

	initialized: false,

	/** @type {string[]} */
	colors: [],

	/** @type {string[]} */
	icons: [],

	async init() {
		this.root.style.setProperty("--accent", this.data.accent);
		this.root.style.setProperty("--accent-raw", this.data.accentRaw.join(" "));

		this.loadingOverlay = new LoadingOverlay();
		this.loadingOverlay.container = app.root.querySelector(":scope > .loadingOverlay");
		this.loadingOverlay.spinner = app.root.querySelector(":scope > .loadingOverlay > .spinner");
		this.loadingOverlay.loading = true;

		this.baseUrl = localStorage.getItem("server.url");

		popup.init();
		ConnectionState.init();
		addEventListener("resize", () => this.updateScreenMode());
		this.updateScreenMode();
		await initGroup(this, "app");

		this.initialized = true;
		this.loaded();
	},

	loaded() {
		screens.activate();
	},

	set loading(loading) {
		this.loadingOverlay.loading = loading;
	},

	string(name, args = {}) {
		if (!this.strings[name]) {
			clog("WARN", `String not found: ${name}`);
			return `string:${name}`;
		}

		/** @type {String} */
		let string = this.strings[name];

		for (let [key, value] of Object.entries(args))
			string = string.replace(`:${key}:`, value);

		return string;
	},

	url(path) {
		return `${this.baseUrl}${path}`;
	},

	api(path) {
		return this.url(`/api${path}`);
	},

	public(path) {
		return `/public${path}`;
	},

	/**
	 * Return hex code of specified color name
	 *
	 * @param	{"accent" | string}	color
	 * @returns	{string}
	 */
	color(color) {
		if (color === "accent")
			return this.data.accent;

		return oscColor(color);
	},

	updateScreenMode() {
		let mode = "desktop";

		if (this.root.clientWidth <= 640)
			mode = "mobile";
		else if (this.root.clientWidth <= 1020)
			mode = "tablet";

		if (mode !== this.currentScreenMode) {
			clog("INFO", `Screen mode changed to`, mode);

			for (let listener of this.screenModeChangeListeners) {
				try {
					listener(mode);
				} catch (e) {
					clog("WARN", `app.updateScreenMode(): listener handled with error`, e);
				}
			}
		}

		this.currentScreenMode = mode;
	},

	/**
	 * Register for screen mode change event.
	 *
	 * @param   {(size: "desktop"|"tablet"|"mobile") => void}   f
	 * @returns {Number}
	 */
	onScreenModeChange(f) {
		f(this.currentScreenMode);
		return this.screenModeChangeListeners.push(f);
	},

	/**
	 * Get current screen mode.
	 *
	 * @return {"desktop"|"tablet"|"mobile"}
	 */
	getScreenMode() {
		return this.currentScreenMode;
	},

	auth: {
		/** @type {TreeDOM} */
		view: undefined,

		/** @type {SQSelect} */
		serverProtocolInput: undefined,
		serverInput: undefined,
		usernameInput: undefined,
		passwordInput: undefined,

		showing: false,

		/** @type {"connect" | "login"} */
		currentMode: null,

		/** @type {SQButton} */
		submitButton: undefined,

		init() {
			this.serverProtocolInput = createSelectInput({
				icon: "globe",
				name: "Giao thức",
				options: {
					http: "HTTP",
					https: "HTTPS",
				},

				value: "http",
				fixed: true
			});

			this.serverInput = createInput({
				id: "login_form_server",
				type: "text",
				label: "Địa chỉ máy chủ",
				required: true,
				autofill: false
			});

			this.usernameInput = createInput({
				id: "login_form_username",
				type: "text",
				label: "Tên đăng nhập",
				required: true,
				autofill: false
			});

			this.passwordInput = createInput({
				id: "login_form_password",
				type: "password",
				label: "Mật khẩu",
				required: true,
				autofill: false
			});

			this.submitButton = createButton("Đăng Nhập", {
				type: "submit",
				color: "accent",
				disabled: true
			});

			const updateButtonState = () => {
				if (this.currentMode === "connect") {
					this.submitButton.disabled = (!this.serverInput.value);
					return;
				}

				this.submitButton.disabled = (!this.usernameInput.value || !this.passwordInput.value);
			}

			this.serverInput.input.addEventListener("input", () => this.updateButtonState());
			this.usernameInput.input.addEventListener("input", () => this.updateButtonState());
			this.passwordInput.input.addEventListener("input", () => this.updateButtonState());

			this.view = makeTree("div", "login-panel", {
				form: { tag: "form", class: "login-form", method: "post", autocomplete: "off", child: {
					logo: new lazyload({ source: app.public("/images/logo-128.png"), classes: "logo" }),

					heading: { tag: "div", class: "heading", child: {
						titl: { tag: "h1", class: "title", text: "---" },
						sub: { tag: "div", class: "sub", html: "---" }
					}},

					content: { tag: "div", class: "content", child: {
						username: this.usernameInput,
						password: this.passwordInput
					}},

					actions: { tag: "div", class: "actions", child: {
						submit: this.submitButton
					}}
				}}
			});

			this.view.form.addEventListener("submit", (e) => {
				e.preventDefault();

				if (this.currentMode === "connect") {
					this.connect();
					return;
				}

				this.login(this.usernameInput.value, this.passwordInput.value);
			});

			this.check();
		},

		updateButtonState() {
			if (this.currentMode === "connect") {
				this.submitButton.disabled = (!this.serverInput.value);
				return;
			}

			this.submitButton.disabled = (!this.usernameInput.value || !this.passwordInput.value);
		},

		async check() {
			if (!app.baseUrl) {
				this.showConnect();
				return;
			}

			try {
				const response = await myajax({
					url: app.api("/auth/hello"),
					method: "GET"
				});

				if (response.code !== 0)
					throw new Error(response.description);
			} catch (e) {
				this.log("ERRR", `Lỗi khi thử kết nối tới máy chủ:`, e);
				this.showConnect();
				return;
			}

			try {
				const response = await myajax({
					url: app.api("/auth/session"),
					method: "GET"
				});

				if (!response.data) {
					this.log("WARN", `Chưa đăng nhập, sẽ hiện bảng đăng nhập...`);
					this.showLogin();
					return;
				}

				const session = Session.processResponse(response.data);
				app.session = session;
				app.user = session.user;
				this.log("INFO", `Đã đăng nhập dưới tài khoản ${app.user.username}`);
				this.completeLogin();
			} catch (e) {
				this.log("ERRR", `Lỗi khi kiểm tra phiên đăng nhập:`, e);
				this.showLogin();
			}
		},

		show() {
			if (this.showing)
				return;

			app.root.appendChild(this.view);
			this.showing = true;
		},

		hide() {
			if (!this.showing)
				return;

			app.root.removeChild(this.view);
			this.showing = false;
		},

		showConnect() {
			this.show();
			emptyNode(this.view.form.content);
			this.view.form.content.appendChild(ScreenUtils.renderFlexRow(
				this.serverProtocolInput.group,
				this.serverInput.group
			));

			this.view.form.heading.titl.innerText = "Kết nối";
			this.view.form.heading.sub.innerHTML = "Hãy nhập <strong>địa chỉ máy chủ</strong> để bắt đầu kết nối tới hệ thống nhà thông minh!";
			this.view.form.actions.submit.dataset.color = "green";
			this.view.form.actions.submit.innerText = "Kết Nối";

			this.currentMode = "connect";
			this.updateButtonState();
		},

		showLogin() {
			this.show();
			emptyNode(this.view.form.content);
			this.view.form.content.append(this.usernameInput.group, this.passwordInput.group);
			this.view.form.heading.titl.innerText = "Đăng nhập";
			this.view.form.heading.sub.innerHTML = "Sử dụng tài khoản <strong>nhà thông minh</strong> của bạn để đăng nhập";
			this.view.form.actions.submit.dataset.color = "accent";
			this.view.form.actions.submit.innerText = "Đăng Nhập";

			this.currentMode = "login";
			this.updateButtonState();
		},

		completeLogin() {
			// app.navbar.userImage.source = app.user.getAvatarUrl();
			// app.navbar.userImage.load();
			// app.navbar.container.right.user.fullname.innerText = app.user.name;

			this.hide();

			app.loading = false;
			screens.activate();
		},

		async connect() {
			this.submitButton.loading = true;

			const protocol = this.serverProtocolInput.value;
			const address = this.serverInput.value.trim().replace(/\/+$/, "");
			const host = `${protocol}://${address}`;

			try {
				const response = await myajax({
					url: `${host}/api/auth/hello`,
					method: "GET"
				});

				if (response.code !== 0)
					throw new Error(response.description);

				app.baseUrl = host;
				localStorage.setItem("server.url", host);
				await this.check();
			} catch (e) {
				this.log("ERRR", `Lỗi khi thử kết nối tới máy chủ:`, e);
				return;
			}

			this.submitButton.loading = false;
		},

		async login(username, password) {
			this.submitButton.loading = true;

			try {
				const response = await myajax({
					url: app.api("/auth/login"),
					method: "POST",
					json: {
						username,
						password
					}
				});

				const session = Session.processResponse(response.data);
				app.session = session;
				app.user = session.user;
				localStorage.setItem("server.session", session.sessionId);
				this.log("INFO", `Đã đăng nhập dưới tài khoản ${app.user.username}`);
				this.completeLogin();
			} catch (e) {
				this.log("ERRR", `Lỗi khi đăng nhập:`, e);

				if (e.data && e.data.code) {
					if (e.data.code === 1)
						this.usernameInput.set({ message: e.data.description });
					else if (e.data.code === 2)
						this.passwordInput.set({ message: e.data.description });
				}
			}

			this.submitButton.loading = false;
		},

		async logout() {
			if (!app.user)
				return;

			try {
				await myajax({
					url: app.api("/auth/logout"),
					method: "POST"
				});

				this.log("INFO", `Đã đăng xuất khỏi tài khoản ${app.user.username}`);
				location.reload();
			} catch (e) {
				this.log("ERRR", `Lỗi khi đăng xuất:`, e);
				location.reload();
			}
		}
	},

	tooltip: {
		init() {
			tooltip.init();
		}
	},

	screen: {
		/** @type {TreeDOM} */
		container: undefined,

		/** @type {{ [id: string]: ScreenChild }} */
		instances: {},

		/** @type {ScreenChild} */
		active: null,

		init() {
			this.container = makeTree("div", "screens", {
				menu: { tag: "div", class: "menu", child: {
					header: { tag: "div", class: "header", child: {
						hTitle: { tag: "div", class: "title", text: app.string("pagetitle") }
					}}
				}},

				content: { tag: "div", class: "content" }
			});

			app.root.appendChild(this.container);
		},

		/**
		 * Parse current screen and state from hash.
		 *
		 * @param	{string}	hash
		 */
		activateByHash(hash) {
			if (!hash || hash.length === 0)
				return;

			this.log("DEBG", `Got current location hash:`, hash);

			if (hash[0] === "#")
				hash = hash.substring(1);

			const [screen, ...data] = hash.split("-");
			const state = {};

			for (const item of data) {
				let [name, value] = item.split(":");

				if (value === "" || value === "null")
					value = null;

				if (!Number.isNaN(value)) {
					value = (value.includes("."))
						? Number.parseFloat(value)
						: Number.parseInt(value);
				}

				state[name] = value;
			}

			if (!this.instances[screen]) {
				this.log("WARN", `Location hash is requesting an undefined screen (${screen}). Ignoring...`);
				return;
			}

			this.log("INFO", `Activating screen ${screen} with state`, state);
			this.instances[screen].activate(state);
		}
	},

	screens
};
