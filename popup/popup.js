let MessageTimeout = null

async function saveCurrentSetup(setupName) {
    const windows = await chrome.windows.getAll({ populate: true });
    const validWindows = windows.filter(window => window.state !== "minimized");
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

        const editCell = document.createElement('td');
        editCell.className = 'edit-cell'
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = '✏️';
        editBtn.title = 'Edit name';
        editBtn.addEventListener('click', () => {
            editSetupName(name, nameCell);
        });
        editCell.appendChild(editBtn);

        const nameCell = document.createElement('td');
        nameCell.className = 'setupnames';
        nameCell.textContent = name;
        nameCell.title = name;
        nameCell.addEventListener('click', () => {
            editSetupName(name, nameCell);
        });
        editCell.appendChild(editBtn);
        
        const loadCell = document.createElement('td');
        loadCell.className = 'load-cell'
        const loadBtn = document.createElement('button');
        loadBtn.className = 'load-btn';
        loadBtn.textContent = 'Load';
        loadBtn.addEventListener('click', () => {
            loadSetup(name);
        });
        loadCell.appendChild(loadBtn);
        
        const saveCell = document.createElement('td');
        saveCell.className = 'save-cell'
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () => {
            overwriteSetup(name);
        });
        saveCell.appendChild(saveBtn);
        
        const deleteCell = document.createElement('td');
        deleteCell.className = 'delete-cell'
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            deleteSetup(name);
        });
        deleteCell.appendChild(deleteBtn);
        
        row.append(editCell, nameCell, loadCell, saveCell, deleteCell);
        Wheretoinsert.appendChild(row);
    });
}

Insertsetupslist()

let editRunning = false

async function editSetupName(oldName, nameCell) {
    if (editRunning) return;
    editRunning = true;
    const originalHTML = nameCell.innerHTML

    const Nameerror = document.getElementById('Nameerror');
    const saveMessage = document.getElementById('saveMessage');

    const editWrapper = document.createElement('div');
    editWrapper.className = 'edit-wrapper';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldName;
    input.className = 'edit-input'

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-edit-btn';
    cancelBtn.textContent = '✕';
    cancelBtn.title = 'Cancel';

    nameCell.innerHTML = ''
    editWrapper.appendChild(input);
    editWrapper.appendChild(cancelBtn);
    nameCell.appendChild(editWrapper);
    input.focus();
    input.select();

    let isValidating = false;

    const saveName = async () => {
        if (isValidating) return;
        isValidating = true;

        const newName = input.value.trim();

        if (!newName || newName === oldName) {
            nameCell.innerHTML = originalHTML;
            editRunning = false
            return;
        }

        if (newName.length > 60) {
            Nameerror.style.display = "block"
            Nameerror.innerText = "The new name must be 60 characters or less."
            saveMessage.style.display = "none";
            saveMessage.innerHTML = "";
            nameCell.innerHTML = originalHTML;
            if (MessageTimeout) {
                clearTimeout(MessageTimeout);
            }
            MessageTimeout = setTimeout(() => {
                Nameerror.style.display = "none";
                Nameerror.innerHTML= "";
            }, 2000);
            editRunning = false;
            return;
        }

        const { setups = {} } = await chrome.storage.local.get('setups');
    
        if (setups[newName]) {
            Nameerror.style.display = "block"
            Nameerror.innerText = "A setup with this name already exists."
            saveMessage.style.display = "none";
            saveMessage.innerHTML = "";
            nameCell.innerHTML = originalHTML;
            if (MessageTimeout) {
                clearTimeout(MessageTimeout);
            }
            MessageTimeout = setTimeout(() => {
                Nameerror.style.display = "none";
                Nameerror.innerHTML= "";
            }, 2000);
            editRunning = false;
            return;
        }

        setups[newName] = setups[oldName];
        delete setups[oldName];
        editRunning = false;
        await chrome.storage.local.set({ setups });
    }

    cancelBtn.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        input.removeEventListener('blur', saveName);
        nameCell.innerHTML = originalHTML;
        editRunning = false;
    });

    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            input.blur();
        } else if (event.key === 'Escape') {
            input.removeEventListener('blur', saveName);
            nameCell.innerHTML = originalHTML;
            editRunning = false;
        }
    });

    input.addEventListener('blur', saveName);
}

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
                left: windowData.left,
                top: windowData.top,
                width: 1,
                height: 1,
                state: "normal",
                focused: true
            });
            await chrome.windows.update(newWindow.id, {
                state: Wstate
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
}

async function overwriteSetup(name) {
    const { setups = {} } = await chrome.storage.local.get('setups');
    if (!setups[name]) return;

    const { skipOverwriteConfirm = false } = await chrome.storage.local.get('skipOverwriteConfirm');
    if (!skipOverwriteConfirm) {
        const confirmed = await showConfirmModal();
        if (!confirmed) return;
    }
    
    const existingAutoload = setups[name].autoload;

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
        }))
    }))
    setups[name] = {
        windowsData: setupData,
        timestamp: Date.now(),
        autoload: existingAutoload
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
    if (!editRunning) Insertsetupslist()
});