chrome.runtime.onStartup.addListener(async () => {
    const { setups = {} } = await chrome.storage.local.get('setups');
    const NameOrders = (await getSortedSetups()).map(entry => entry[0]);
    NameOrders.forEach(name => {
        if (setups[name].autoload) {
            loadSetup(name);
        }
    });
});

async function loadSetup(name) {
    const { setups = {} } = await chrome.storage.local.get('setups')
    const setup = setups[name]
    if (!setup || !setup.windowsData) {
        console.error("Save not found", name)
        return;
    }
    const windowsData = setup.windowsData
    for (const windowData of windowsData) {
        const Wstate = windowData.state || "normal";
        let newWindow;
        if (Wstate === "maximized" || Wstate === "fullscreen") {
            newWindow = await chrome.windows.create({
                state: Wstate,
                focused: true
            })
        } else { 
            newWindow = await chrome.windows.create({
                left: windowData.left,
                top: windowData.top,
                width: windowData.width,
                height: windowData.height,
                state: Wstate,
                focused: false
            });
        }
        const [defaultTab] = await chrome.tabs.query({ windowId: newWindow.id });

        for (const tabData of windowData.tabs) {
            const newTab = await chrome.tabs.create({
                windowId: newWindow.id,
                url: tabData.url,
                pinned: tabData.pinned,
                active: tabData.active,
                index: tabData.index
            });
        }
        if (defaultTab) {
            await chrome.tabs.remove(defaultTab.id);
        }
    }
};

async function getSortedSetups() {
    const { setups = {} } = await chrome.storage.local.get('setups');
    const sorted = Object.entries(setups)
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
    return sorted
};