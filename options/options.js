let MessageTimeout = null

const CloseOnLoad = document.getElementById("closewindowsonload");

CloseOnLoad.addEventListener('change', () => {
    chrome.storage.local.set({ closeAllOnLoad: CloseOnLoad.checked })
});

const restoreOptions = chrome.storage.local.get({ closeAllOnLoad: false,
}).then((items) => {
    CloseOnLoad.checked = items.closeAllOnLoad
})


async function getSortedSetups() {
    const { setups = {} } = await chrome.storage.local.get('setups');
    const sorted = Object.entries(setups)
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
    return sorted
};

async function Insertsetupslist() {
    const Wheretoinsert = document.getElementById('Setupstable');
    const Setuplist = await getSortedSetups();
    const NameOrders = Setuplist.map(entry => entry[0]);
    const SetupData = Setuplist.map(entry => entry[1]);
    let date = [];
    
    Wheretoinsert.innerHTML = "";
    
    const headerRow = document.createElement('tr');

    const editHeader = document.createElement('th');
    editHeader.id = 'edit-header';
    editHeader.textContent = '';
    
    const nameHeader = document.createElement('th');
    nameHeader.id = 'name-header';
    nameHeader.textContent = 'Setups';
    
    const autoHeader = document.createElement('th');
    autoHeader.id = 'auto-header';
    autoHeader.textContent = 'Autoload on startup';
    
    headerRow.appendChild(editHeader);
    headerRow.appendChild(nameHeader);
    headerRow.appendChild(autoHeader);
    Wheretoinsert.appendChild(headerRow);
    
    SetupData.forEach(time => {
        let dateObj = new Date(time.timestamp)
        dateObj = dateObj.toLocaleDateString() + ' - ' + dateObj.toLocaleTimeString();
        date.push(dateObj.toString())
    })

    NameOrders.forEach((name, index) => {
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
        nameCell.innerHTML += `<br><a class="timestamp">Last saved ${date[index]}</a>`
        nameCell.title = name;
        nameCell.addEventListener('click', () => {
            editSetupName(name, nameCell);
        });
        row.append(editCell);
        row.append(nameCell);

        const autoCell = document.createElement('td');
        autoCell.className = 'auto-cell'
        
        const autoLabel = document.createElement('label');
        const autoInput = document.createElement('input');
        const autoSpan = document.createElement('span');

        autoLabel.className = 'switch';

        autoInput.id = `autoload-${name}`;
        autoInput.type = 'checkbox';
        const currentSetupData = SetupData[index];
        autoInput.checked = currentSetupData.autoload;
        autoInput.addEventListener('change', async () => {
            const { setups = {} } = await chrome.storage.local.get('setups');
            
            if (setups[name]) {
                setups[name].autoload = autoInput.checked;
                await chrome.storage.local.set({ setups });
            }
        });

        autoSpan.className = 'slider round';
        
        autoLabel.appendChild(autoInput);
        autoLabel.appendChild(autoSpan);
        autoCell.appendChild(autoLabel);
        
        row.appendChild(autoCell);
        Wheretoinsert.appendChild(row);
    });
};

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

        const Nameerror = document.getElementById('Nameerror');
        const saveMessage = document.getElementById('saveMessage');

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

chrome.storage.onChanged.addListener((changes, area) => {
    Insertsetupslist()
});