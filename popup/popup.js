let MessageTimeout = null

async function saveCurrentSetup(setupName) {
    const windows = await chrome.windows.getAll({ populate: true });
    
    const setupData = windows.map(window => ({
        left: window.left,
        top: window.top,
        width: window.width,
        height: window.height,
        state: window.state,
        tabs: window.tabs.map(tab => ({
            url: tab.url,
            pinned: tab.pinned,
            active: tab.active,
            index: tab.index
        }))
    }));

    const { setups = {} } = await chrome.storage.local.get('setups');
    
    setups[setupName] = {
        windowsData: setupData,
        timestamp: Date.now()
    };
    
    await chrome.storage.local.set({setups});
}

async function generateSetupName() {
    const { setups = {} } = await chrome.storage.local.get('setups');
    const existingNames = Object.keys(setups);
    
    let setupNumbers = existingNames.filter(name => name.match(/^Setup \d+$/))
    setupNumbers = setupNumbers.map(name => parseInt(name.replace('Setup ', '')));

    let nextNumber;
    if (setupNumbers.length > 0) {
        nextNumber = Math.max(...setupNumbers) + 1;
    } else {
        nextNumber = 1;
    }
    
    return `Setup ${nextNumber}`;
}


const savebutton = document.getElementById("saveSetup")
savebutton.addEventListener("click", async () => {
    let input = document.getElementById("setupName")
    let setupName = input.value.trim();
    const Nameerror = document.getElementById("Nameerror");
    const saveMessage = document.getElementById("saveMessage");
    Nameerror.style.display = "none";
    Nameerror.textContent = "";
    if (!setupName) {
        setupName = await generateSetupName()
        input.value = "";
    }
    if (setupName.length>26) {
        Nameerror.style.display = "block"
        Nameerror.textContent = "Please enter a name with 26 characters or less."
    } 
    else {
        const Existingnames = (await getSortedSetups()).map(entry => entry[0])
        if (Existingnames.includes(setupName)) {
            Nameerror.style.display = "block";
            Nameerror.textContent = "A setup with this name already exists. (Press Save next a setup to overwrite it.)";
            if (MessageTimeout) {
                clearTimeout(MessageTimeout);
            };
            MessageTimeout = setTimeout(() => {
                Nameerror.style.display = "none";
                Nameerror.textContent = "";
            }, 2000);
        }
        else {
            Nameerror.style.display = "none";
            Nameerror.textContent = "";
            await saveCurrentSetup(setupName)
            saveMessage.style.display = "block";
            saveMessage.textContent = `${setupName} saved successfully!`;
            input.value = "";
            if (MessageTimeout) {
                clearTimeout(MessageTimeout);
            };
            MessageTimeout = setTimeout(() => {
                saveMessage.style.display = "none";
                saveMessage.textContent = "";
            }, 2000);
        }
    }
});

async function getSortedSetups() {
    const { setups = {} } = await chrome.storage.local.get('setups');
    const sorted = Object.entries(setups)
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
    return sorted
};

async function Insertsetupslist() {
    const Wheretoinsert = document.getElementById('Setupstable');
    const NameOrders = (await getSortedSetups()).map(entry => entry[0]);
    let toinsert = "";
    NameOrders.forEach(name => {
        toinsert += `<tr>
        <td class="setupnames">${name}</td>
        <td><button id="${name}load">Load</button></td>
        <td><button id="${name}overwrite">Save</button></td>
        <td><button id="${name}delete">Delete</button></td>
        </tr>`
        });
        
    Wheretoinsert.innerHTML = toinsert

    NameOrders.forEach(name => {
        document.getElementById(`${name}load`).addEventListener('click', () => {
            loadSetup(name);
        });
        
        document.getElementById(`${name}overwrite`).addEventListener('click', () => {
            overwriteSetup(name);
        });
        
        document.getElementById(`${name}delete`).addEventListener('click', () => {
            deleteSetup(name);
        });
    });
};
Insertsetupslist()

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
            await chrome.tabs.create({
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
}

async function overwriteSetup(name) {
    const { setups = {} } = await chrome.storage.local.get('setups');
    if (!setups[name]) return;

    const { skipOverwriteConfirm = false } = await chrome.storage.local.get('skipOverwriteConfirm');
    if (!skipOverwriteConfirm) {
        const confirmed = await showConfirmModal();
        if (!confirmed) return;
    }
    
    const windows = await chrome.windows.getAll({ populate: true });
    const setupData = windows.map(window => ({
        left: window.left,
        top: window.top,
        width: window.width,
        height: window.height,
        state: window.state,
        tabs: window.tabs.map(tab => ({
            url: tab.url,
            pinned: tab.pinned,
            active: tab.active,
            index: tab.index
        }))
    }))
    setups[name] = {
        windowsData: setupData,
        timestamp: Date.now()
    };
    await chrome.storage.local.set({setups});
    const saveMessage = document.getElementById("saveMessage")
    saveMessage.style.display = "block";
    saveMessage.textContent = `${name} saved successfully!`;
    if (MessageTimeout) {
        clearTimeout(MessageTimeout);
    }
    MessageTimeout = setTimeout(() => {
        saveMessage.style.display = "none";
        saveMessage.textContent = "";
    }, 2000);
}

async function deleteSetup(name) {
    const { setups = {} } = await chrome.storage.local.get('setups');
    if (setups[name]) {
        delete setups[name];
        await chrome.storage.local.set({ setups });
    }
}


function showConfirmModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const confirmBtn = document.getElementById('confirmBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const dontShowAgain = document.getElementById('dontShowAgain');

        modal.style.display = 'block';

        confirmBtn.onclick = async () => {
            if (dontShowAgain.checked) {
                await chrome.storage.local.set({ skipOverwriteConfirm: true });
            }
            modal.style.display = 'none';
            dontShowAgain.checked = false;
            resolve(true);
        };
        
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            dontShowAgain.checked = false;
            resolve(false);
        };
        
        modal.querySelector('.modal-overlay').onclick = () => {
            modal.style.display = 'none';
            dontShowAgain.checked = false;
            resolve(false);
        };
    });
}


chrome.storage.onChanged.addListener((changes, area) => {
    Insertsetupslist()
});