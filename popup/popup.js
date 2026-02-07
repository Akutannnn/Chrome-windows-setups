let MessageTimeout = null

async function saveCurrentSetup(setupName) {
    const windows = await chrome.windows.getAll({ populate: true });
    console.log("All windows:", windows);
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
            index: tab.index,
            groupId: tab.groupId
        }))
    }));
    for (let i = 0; i < windows.length; i++) {
        const windowId = windows[i].id;
        const groups = await chrome.tabGroups.query({ windowId: windowId });
        
        setupData[i].groups = groups.map(group => ({
            id: group.id,
            title: group.title,
            color: group.color,
            collapsed: group.collapsed
        }));
    }

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
    Nameerror.innerHTML = "";
    if (!setupName) {
        setupName = await generateSetupName()
        input.value = "";
    }
    if (setupName.length>60) {
        if (MessageTimeout) {
        clearTimeout(MessageTimeout);
        }
        Nameerror.style.display = "block"
        Nameerror.innerText = "Please enter a name with 60 characters or less."
        saveMessage.style.display = "none";
        saveMessage.innerHTML = "";
    } 
    else {
        const Existingnames = (await getSortedSetups()).map(entry => entry[0])
        if (Existingnames.includes(setupName)) {
            Nameerror.style.display = "block";
            Nameerror.innerHTML = "A setup with this name already exists.<br>(Press Save next a setup to overwrite it.)";
            saveMessage.style.display = "none";
            saveMessage.innerHTML = "";
            if (MessageTimeout) {
                clearTimeout(MessageTimeout);
            };
            MessageTimeout = setTimeout(() => {
                Nameerror.style.display = "none";
                Nameerror.innerHTML = "";
            }, 3800);
        }
        else {
            Nameerror.style.display = "none";
            Nameerror.innerHTML = "";
            await saveCurrentSetup(setupName)
            saveMessage.style.display = "block";
            saveMessage.innerText = `${setupName} saved successfully!`;
            input.value = "";
            if (MessageTimeout) {
                clearTimeout(MessageTimeout);
            };
            MessageTimeout = setTimeout(() => {
                saveMessage.style.display = "none";
                saveMessage.innerHTML = "";
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
    
    Wheretoinsert.innerHTML = "";
    
    NameOrders.forEach(name => {
        const row = document.createElement('tr');

        const nameCell = document.createElement('td');
        nameCell.className = 'setupnames';
        nameCell.textContent = name;
        nameCell.title = name;
        
        const loadCell = document.createElement('td');
        const loadBtn = document.createElement('button');
        loadBtn.className = 'load-btn';
        loadBtn.textContent = 'Load';
        loadBtn.addEventListener('click', () => {
            loadSetup(name);
        });
        loadCell.appendChild(loadBtn);
        
        const saveCell = document.createElement('td');
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () => {
            overwriteSetup(name);
        });
        saveCell.appendChild(saveBtn);
        
        const deleteCell = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            deleteSetup(name);
        });
        deleteCell.appendChild(deleteBtn);
        
        row.append(nameCell, loadCell, saveCell, deleteCell);
        Wheretoinsert.appendChild(row);
    });
}


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

        const createdTabs = [];
        for (const tabData of windowData.tabs) {
            const newTab = await chrome.tabs.create({
                windowId: newWindow.id,
                url: tabData.url,
                pinned: tabData.pinned,
                active: tabData.active,
                index: tabData.index
            });
            createdTabs.push({
                tab: newTab,
                originalGroupId: tabData.groupId || -1
            })
        }
        if (windowData.groups && windowData.groups.length > 0) {
            for (const groupData of windowData.groups) {
                const tabsInGroup = createdTabs
                    .filter(ct => ct.originalGroupId === groupData.id)
                    .map(ct => ct.tab.id);
                
                if (tabsInGroup.length > 0) {
                    const newGroupId = await chrome.tabs.group({
                        tabIds: tabsInGroup,
                        createProperties: { windowId: newWindow.id }
                    });
                    
                    await chrome.tabGroups.update(newGroupId, {
                        title: groupData.title,
                        color: groupData.color,
                        collapsed: groupData.collapsed
                    });
                }
            }
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
            index: tab.index,
            groupId: tab.groupId 
        }))
    }))
    for (let i = 0; i < windows.length; i++) {
        const windowId = windows[i].id;
        const groups = await chrome.tabGroups.query({ windowId: windowId });
        
        setupData[i].groups = groups.map(group => ({
            id: group.id,
            title: group.title,
            color: group.color,
            collapsed: group.collapsed
        }));
    }
    setups[name] = {
        windowsData: setupData,
        timestamp: Date.now()
    };
    await chrome.storage.local.set({setups});
    const saveMessage = document.getElementById("saveMessage")
    const Nameerror = document.getElementById("Nameerror")
    Nameerror.style.display = "none";
    Nameerror.innerText = "";
    saveMessage.style.display = "block";
    saveMessage.innerText = `${name} saved successfully!`;

    if (MessageTimeout) {
        clearTimeout(MessageTimeout);
    }
    MessageTimeout = setTimeout(() => {
        saveMessage.style.display = "none";
        saveMessage.innerHTML= "";
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