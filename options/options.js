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
    const nameHeader = document.createElement('th');
    nameHeader.textContent = 'Setups';
    nameHeader.style.textAlign = 'left';
    
    const autoHeader = document.createElement('th');
    autoHeader.textContent = 'Autoload on startup';
    autoHeader.style.textAlign = 'right';
    
    headerRow.appendChild(nameHeader);
    headerRow.appendChild(autoHeader);
    Wheretoinsert.appendChild(headerRow);
    
    SetupData.forEach(time => {
        let dateObj = new Date(time.timestamp)
        dateObj = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
        date.push(dateObj.toString())
    })

    NameOrders.forEach((name, index) => {
        const row = document.createElement('tr');

        const nameCell = document.createElement('td');
        nameCell.className = 'setupnames';
        nameCell.textContent = name;
        nameCell.innerHTML += `<br><a class="timestamp">Last saved ${date[index]}</a>`
        nameCell.title = name;
        row.append(nameCell);

        const autoCell = document.createElement('td');
        autoCell.style.textAlign = 'right';
        autoCell.style.verticalAlign = 'middle';
        
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

chrome.storage.onChanged.addListener((changes, area) => {
    Insertsetupslist()
});