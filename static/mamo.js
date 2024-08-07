/*! *****************************************************************************
MAMO web view
https://github.com/hotrooibos/MAMO

Author: Antoine Marzin
Released under the MIT license
https://github.com/hotrooibos/MAMO?tab=MIT-1-ov-file

ASCII comments : https://www.patorjk.com/software/taag/#p=display&f=ANSI%20Regular
***************************************************************************** */

// General
const doc               = document;
const wrapper           = doc.querySelector('#wrapper');
const delDialog         = doc.querySelector('#dialog-del');
const synDialog         = doc.querySelector('#dialog-syn');

// Table
const redirList         = doc.querySelector('#redir-list');
const redirTabl         = doc.querySelector('#redir-tab');
const tbody             = redirTabl.querySelector('tbody');

// Table servitudes
const showHideBtn       = doc.querySelector('#show-hide');
const refreshBtn        = doc.querySelector('#refresh-redirs');
const syncBtn           = doc.querySelector('#sync-remote');
const newAliasBtn       = doc.querySelector('#new-alias');
const saveAliasBtn      = doc.querySelector('#save-alias');
const cancelAliasBtn    = doc.querySelector('#cancel-alias');
const domainSelect      = doc.querySelector('#domain-select');
const destSelect        = doc.querySelector('#dest-select');
const redirCount        = doc.querySelector('#redir-count');
const findInput         = doc.querySelector('#find');

// Global vars
let workingDomain       = domainSelect.value;
let destAddr            = destSelect.value;

class Redir {
    constructor(id, name, date, alias, to) {
        this.id = id;
        this.name = name;
        this.date = date;
        this.alias = alias;
        this.to = to;
    }

    getJsonStr() {
        const jsonObj = {
            "id" : this.id,
            "name" : this.name,
            "date" : this.date,
            "alias" : this.alias,
            "to" : this.to
        }

        return JSON.stringify(jsonObj);
    }

    /**
     * Backend call to fill redirection object attributes from its ID
     */
        async fillFromId() {
            const res = await fetch('/get_redir', {
                method: 'post',
                body: JSON.stringify(this.id),
            });
    
            let resText = await res.text();
            resText = JSON.parse(resText);

            this.name = resText['name'];
            this.date = resText['date'];
            this.alias = resText['alias'];
            this.to = resText['to'];
        }

    /**
     * Backend call to create a redirection
     * 
     * Reponse text : (string) JSON string of the created redir
     * 
     * {
     *      "id" : id,
     *      "name" : name,
     *      "date" : date,
     *      "alias" : alias,
     *      "to" : to
     * }
     */
    async create() {
        const res = await fetch('/set_redir', {
            method: 'post',
            body: this.getJsonStr(),
        });

        return res;
    }

    /**
     * Backend call to remove redirections
     * 
     * Reponse text : (string) provider return message
     */
    async remove() {
        const res = await fetch('/del_redir', {
            method: 'post',
            body: this.getJsonStr(),
        });

        return res;
    }
}

/*
 *
 *  ██████  ██████  ███    ███ ███    ███  ██████  ███    ██ ███████ 
 * ██      ██    ██ ████  ████ ████  ████ ██    ██ ████   ██ ██      
 * ██      ██    ██ ██ ████ ██ ██ ████ ██ ██    ██ ██ ██  ██ ███████ 
 * ██      ██    ██ ██  ██  ██ ██  ██  ██ ██    ██ ██  ██ ██      ██ 
 *  ██████  ██████  ██      ██ ██      ██  ██████  ██   ████ ███████ 
 *
 */

function showInfobox(msg) {
    const boxesArr = doc.querySelectorAll('.msgbox');

    // Move down msg boxes actually displayed
    for (let i = 0; i < boxesArr.length; i++) {
        const box = boxesArr[i];
        box.style.top = (parseFloat(box.style.top) + 4) + "em";
    }

    // Create the new box on the top
    const newBox = doc.createElement('div');
    newBox.setAttribute('id', 'msgbox');
    newBox.setAttribute('class', 'msgbox');
    newBox.innerText = msg;
    newBox.style.top = "1em";
    wrapper.appendChild(newBox);

    // Schedule the new box to be removed after 5s
    setTimeout((e) => {
        doc.querySelector('.msgbox').remove();
    }, 8000);
}


/**
 * Convert epoch dates from <time> tags into readable date
 * 
 * Takes an optional parameter of nodes list (array) of <time> elements to convert
 * 
 * If no parameter is set, it will convert all <time> founds on page
 */
function convertEpoch(timeElements) {
    let dates;

    if (timeElements) {
        dates = timeElements;
    } else {
        dates = doc.querySelectorAll('time');
    }

    // Convert epoch integers to dd/mm/yyyy
    for (const d of dates) {
        if (d.innerText) {
            dt = parseInt(d.innerText);
            dt = new Date(dt * 1000);

            const options = {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric'
            };

            const formatedDate = new Intl.DateTimeFormat('en-GB', options).format(dt);

            d.innerText = formatedDate;
        }
    }
}


/**
 * Control that an alias (with attributes name, alias, to)
 * format is valid (no linebreak, e-mail format...)
 */
function controlAlias(td) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    let text;

    switch (td.dataset.aliasItem) {
        case "name":
            text = td.innerText;
            break;

        case "alias":
            // Since we have a button (uuid gen) inside <td>
            text = td.childNodes[0].innerText;

            if (text.split('@')[1] != workingDomain)
                console.log("Wrong domain: " + text.split('@')[1] + " != " + workingDomain)
            break;

        case "to":
            text = td.innerText;
            break;

        default:
            break;
    }

    // Clear line breaks
    text = text.replace(/(\r\n|\n|\r)/gm, "");

    // Return true if text matches the email format regex
    return re.test(text);
}


/**
 * Disable use of Enter key to prevent line break
 */
function disableEnterKey(e) {
    if (e.keyCode === 13)
        e.preventDefault();
}


/*
 *
 * ████████  █████  ██████  ██      ███████ 
 *    ██    ██   ██ ██   ██ ██      ██      
 *    ██    ███████ ██████  ██      █████   
 *    ██    ██   ██ ██   ██ ██      ██      
 *    ██    ██   ██ ██████  ███████ ███████ 
 *
 */

const rowTemplate = (key, name, date, alias, to) => {
    const res =
    `<tr id="${key}">
        <td data-alias-item="name">${name}</td>
        <td data-alias-item="date"><time>${date}</time></td>
        <td data-alias-item="alias"><div>${alias}</div><div><button class="randword-btn"><i class="feather-16" data-feather="refresh-cw"></i></button><button class="uuid-btn">UUID</button><button class="clipboard-btn"><i class="feather-16" data-feather="clipboard"></i></button></div>
        </td>
        <td data-alias-item="to">${to}</td>
        <td data-alias-item="edit" class="text-center no-wrap">
            <button class="btn-edit"><i data-feather="edit"></i></button>
            <button class="btn-del"><i data-feather="trash-2"></i></button>
        </td>
    </tr>`;

    return res;
};

/**
 * Table
 * Update the table with JSON data in parameter
 */
function updateTable(jsonObj) {
    // let startTime = performance.now()

    let newTbodyContent = "";

    // For each alias, add row to HTML string from row template
    for (const key in jsonObj)
        newTbodyContent += rowTemplate(key,
                                       jsonObj[key]['name'],
                                       jsonObj[key]['date'],
                                       jsonObj[key]['alias'],
                                       jsonObj[key]['to']);

    // Apply the HTML string to the table body HTML
    tbody.innerHTML = newTbodyContent;

    // let endTime = performance.now()
    // console.log(`${endTime - startTime} milliseconds`)

    redirCount.innerText = Object.keys(jsonObj).length;

    // Feather icons : replace <i data-feather> with icons
    // https://github.com/feathericons/feather?tab=readme-ov-file#featherreplaceattrs
    feather.replace();

    convertEpoch();
    setActionBtns();
}


/**
 * Add a new alias row filled with data from 
 * the given redirection object (context)
 * or from a generic template (no context) 
 */
async function addRow(context) {
    const newRow = doc.createElement('tr');
    let newInput 
    let id, name, date, alias, to;

    // Context given, insert row with context informations
    if (context.id) {
        id = context.id;
        name = context.name;
        date = context.date;
        alias = context.alias;
        to = context.to;
    }

    // No context, create generic row (new redir)
    if (!context.id) {
        const domain = workingDomain == "all" ? "domain.com" : workingDomain;
        name = "New alias";
        date = "";
        alias = await genName() + "@" + domain;
        to = destAddr;
    }

    newRow.innerHTML = rowTemplate( id,
                                    name,
                                    date,
                                    alias,
                                    to);

    tbody.insertAdjacentElement("afterbegin", newRow);

    feather.replace();

    // Affect click listeners to all the
    // buttons belonging to the row
    setActionBtns();

    // No context, set row as editable
    if (!context.id) {
        setEditable(newRow);
            
        // Enable Save / Cancel btn
        saveAliasBtn.disabled = false;
        cancelAliasBtn.disabled = false;
    }
}


/**
 * Transform the given row (<TR> element)
 * and its children to an editable
 */
function setEditable(row) {
    const tdArr = row.querySelectorAll('td');
    const uuidBtn = row.querySelector('.uuid-btn');
    const randwordBtn = row.querySelector('.randword-btn');

    row.__edit = true;
    uuidBtn.style.display = " block";
    randwordBtn.style.display = "block";

    // Make TDs editables
    for (const td of tdArr) {
        switch (td.dataset.aliasItem) {
            case "name":
            case "alias":
            case "to":
                td.contentEditable = true;
                td.classList.add('td-editable');

                td.__origContent = td.innerHTML;

                // And Enter key press listener to prevent line breaks
                td.addEventListener('keydown', disableEnterKey, false);
                break;
            default:
                break;
        }
    }
}


/**
 * Makes cells from a specific row editables
 * Called when clicking an edit row btn
 */
function editRow(e) {
    const clickedEle = e.target;
    const parentTr = clickedEle.parentElement.closest('tr');

    setEditable(parentTr);

    saveAliasBtn.disabled = false;
    cancelAliasBtn.disabled = false;
}

/**
 * Delete a row
 */
function delRow(row) {
    row.parentNode.removeChild(row);
}


/**
 * Table sort
 */
function sortTable(n) {
    let rows,
        i = 0,
        x = "",
        y = "",
        count = 0;
    let switching = true;
    let shouldSwitch;

    // Order is set as ascending
    let direction = 'ascending';

    // Run loop until no switching is needed
    while (switching) {
        switching = false;
        rows = tbody.rows;

        //Loop to go through all rows
        for (i = 0; i < rows.length - 1; i++) {
            shouldSwitch = false;

            // Fetch 2 elements that need to be compared
            x = rows[i].getElementsByTagName('TD')[n];
            y = rows[i + 1].getElementsByTagName('TD')[n];

            // Check the direction of order
            if (direction == 'ascending') {
                // Check if 2 rows need to be switched
                if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
                    // If yes, mark Switch as needed and break loop
                    shouldSwitch = true;
                    break;
                }
            } else if (direction == 'descending') {
                // Check direction
                if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
                    // If yes, mark Switch as needed and break loop
                    shouldSwitch = true;
                    break;
                }
            }
        }
        if (shouldSwitch) {
            // Function to switch rows and mark switch as completed
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;

            // Increase count for each switch
            count++;
        } else {
            // Run while loop again for descending order
            if (count == 0 && direction == 'ascending') {
                direction = 'descending';
                switching = true;
            }
        }
    }
}


/**
 * Create/save modified aliases 
 * Called when clicking the save btn
 */
async function saveAlias(e) {
    const trArr = tbody.querySelectorAll('tr');
    const editTrArr = [];
    let newRedir;
    let name;
    let alias;
    let to;
    let isValidFormat = true;
    let err = false;

    // Make array of edited modified rows
    for (const tr of trArr)
        if (tr.__edit)
            editTrArr.push(tr);

    // Loop through modified rows
    // - Check format validity for each edited cell
    // - Process creation/edition if ok
    for (const tr of editTrArr) {
        let editCellOld;
        
        // Format validation
        for (const td of tr.children) {    
            switch (td.dataset.aliasItem) {
                case "name":
                    controlAlias(td);
                    name = td.innerText;
                    continue;

                case "alias":
                    isValidFormat = controlAlias(td);
                    if (isValidFormat)
                        alias = td.childNodes[0].innerText;
                    else {
                        td.classList.add('input-err');
                        showInfobox("Create alias : wrong alias address format");
                        err = true;
                    }
                    continue;

                case "to":
                    isValidFormat = controlAlias(td);
                    if (isValidFormat)
                        to = td.innerText;
                    else {
                        td.classList.add('input-err');
                        showInfobox("Create alias : wrong destination address format");
                        err = true;
                    }
                    continue;

                case "edit":
                    // Blinking dots / loading signal
                    editCellOld = td.innerHTML;
                    td.innerHTML = '<div class="dot-flashing"></div>';

                    break;

                default:
                    break;
            }
        }

        // Create/edit
        if (!err) {
            newRedir = {
                "id" : tr.id,
                "name" : name,
                "alias" : alias,
                "to" : to
            }

            // Creation : new alias (row has no id)
            if (!tr.id) {
                const redir = new Redir("", name, "", alias, to);                                    
                
                redir.create()
                .then(res => res.text())
                .then((resText) => {
                    const resObj = JSON.parse(resText);
                    const date = tr.querySelector('time');
                    const editTd = tr.querySelector("td[data-alias-item='edit'");
                    tr.id = resObj.id;
                    date.innerText = resObj.date;
                    convertEpoch([date]);
                    editTd.innerHTML = editCellOld;
                    lockRows(tr);
                    setActionBtns(tr);
                });

            }

            // Edition : alias with __edit property
            else if (tr.__edit)
                editRedir(newRedir);

            // const aliasData = await getAliasList(e);
            // updateTable(aliasData);
        }
    }
}


/**
 * Lock editable cells for a given row (context)
 * or every cells within the table if no context
 * specified
 */
function lockRows(context) {
    // Identify row/cells under edition within the given row
    // or, if no row's specified, within the whole table
    let trArr;

    if (context != undefined && context.nodeName === "TR") {
        trArr = [context];
    } else {
        trArr = tbody.querySelectorAll('tr');
    }

    for (const tr of trArr) {
        // Delete rows with no ID (cancelled new alias creation)
        if (!tr.id) {
            tr.remove();
            continue;
        }

        const uuidBtn = tr.querySelector('.uuid-btn');
        const randwordBtn = tr.querySelector('.randword-btn');
        uuidBtn.style.display = "none";
        randwordBtn.style.display = "none";

        // For all rows under edition :
        //  - Terminate row/cells edition
        //  - Restore the previous values
        if (tr.__edit) {
            delete tr.__edit;
            for (const td of tr.children) {
                td.contentEditable = false;
                td.classList.remove('td-editable');
            }
        }
    }
}


/**
 * Cancel all ongoing editions on table by
 * rolling back values to initial ones
 */
function cancelAliasOperations() {
    const editedTdArr = tbody.querySelectorAll('td[contenteditable]');

    saveAliasBtn.disabled = true;
    cancelAliasBtn.disabled = true;

    for (const td of editedTdArr)
        if (td.__origContent)
            td.innerHTML = td.__origContent;

    lockRows();
}


/**
 * Copy alias to clipboard
 */
function aliasCopy() {
    const parentTd = this.closest('td');
    let copyText = parentTd.childNodes[0].innerText;
    copyText = copyText.trim();
    navigator.clipboard.writeText(copyText);
    showInfobox(`${copyText} copied to clipboard`);
}


/**
 * Add action for tool buttons
 */
async function toolBtnAction() {
    const parentTr = this.parentElement.closest('tr');
    const parentTd = this.parentElement.closest('td');

    // UUID generation for alias
    if (this.classList.contains('uuid-btn')) {
        const newAlias = crypto.randomUUID() + "@" + workingDomain;
        parentTd.firstChild.innerText = newAlias;

    // Random word generation for alias
    } else if (this.classList.contains('randword-btn')) {
        const newAlias = await genName() + "@" + workingDomain;
 
        // TODO : check if generated alias doesnt already exist, and if so, generate another
        // const aliasData = await getAliasList(workingDomain);
        // let aliasArr = [];
        // console.log(Object.entries(aliasData));

        // for (const [k, v] in Object.entries(aliasData)) {
        //     console.log(typeof(v['0']));
        // }

        parentTd.firstChild.innerText = newAlias;
    
    // Delete btn
    } else if (this.classList.contains('btn-del')) {
        const id = parentTr.id;

        // If parent row has an ID, we want to delete an existing alias,
        // Else, we are just canceling/removing a new alias creation row
        if (id) {
            const alias = parentTr.querySelector('td[data-alias-item="alias"]').childNodes[0].data;
            const yesBtn = delDialog.querySelector('button[name="delete-id"]');

            yesBtn.value = id;
            yesBtn.addEventListener('click', delAlias);
            delDialog.querySelector('p').innerText = `Remove alias ${alias} ?`;
            delDialog.returnValue = 'cancel';
            delDialog.showModal();            
        } else {
            parentTr.remove();
        }
    }
}


/**
 * Delete alias
 */
async function delAlias() {
    const id = this.value;

    // Delete redirection
    const redir = new Redir (id);
    await redir.fillFromId();
    const res = await redir.remove();

    switch (this.name) {

        // "Yes" btn from delete confirmation dialog
        case "delete-id":
            if (res.status == 200) {
                showInfobox("Removed alias " + redir.alias);

                // Remove row from table
                for (const tr of tbody.querySelectorAll('tr')) {
                    if (tr.id == id)
                        tr.remove();
                }
            } else {
                showInfobox("An error occured while removing alias " + redir.alias + " :\n" + await res.text());
            }
            break;

        default:
            break;
    }
}


/**
 * Set actions for buttons of a given row (context)
 * or every buttons within the table if no context
 * specified
 */
function setActionBtns(context) {
    let clipboardBtns;
    let uuidBtns;
    let randwordBtns;
    let delBtns;
    let editBtns;

    if (context != undefined && context.nodeName === "TR") {
        clipboardBtns = context.querySelectorAll('.clipboard-btn');
        uuidBtns = context.querySelectorAll('.uuid-btn');
        randwordBtns = context.querySelectorAll('.randword-btn');
        delBtns = context.querySelectorAll('.btn-del');
        editBtns = context.querySelectorAll('.btn-edit');
    } else {
        clipboardBtns = doc.querySelectorAll('.clipboard-btn');
        uuidBtns = doc.querySelectorAll('.uuid-btn');
        randwordBtns = doc.querySelectorAll('.randword-btn');
        delBtns = doc.querySelectorAll('.btn-del');
        editBtns = doc.querySelectorAll('.btn-edit');
    }

    // Copy to clipboard buttons
    for (const btn of clipboardBtns)
        btn.addEventListener('click', aliasCopy);

    // UUID gen buttons
    for (const btn of uuidBtns)
        btn.addEventListener('click', toolBtnAction);

    // Random word gen buttons
    for (const btn of randwordBtns)
        btn.addEventListener('click', toolBtnAction);

    // Delete buttons, show modal
    for (const btn of delBtns)
        btn.addEventListener('click', toolBtnAction);

    // Edit buttons
    for (const btn of editBtns)
        btn.addEventListener('click', editRow);
}


/*
 *
 * ███████ ███████ ████████  ██████ ██   ██ ███████ ███████ 
 * ██      ██         ██    ██      ██   ██ ██      ██      
 * █████   █████      ██    ██      ███████ █████   ███████ 
 * ██      ██         ██    ██      ██   ██ ██           ██ 
 * ██      ███████    ██     ██████ ██   ██ ███████ ███████ 
 * 
 */


/**
 * Backend call to edit a redirection
 */
async function editRedir(jsonObj) {
    showInfobox("Editing alias " + jsonObj['alias']);

    const jsonStr = JSON.stringify(jsonObj);

    try {
        const res = await fetch('/edit_redir', {
            method: 'post',
            body: jsonStr,
        });

        const resText = await res.text();

        if (res.status == 200) {
            showInfobox("Alias edited succesfully !");
        } else {
            showInfobox("Edit error:\n" + resText);
        }

    } catch (error) {
        showInfobox(error);
    }
}


/**
 * Backend call to get a string alias list
 * return it as a JSON object (dict)
 */
async function getAliasList(e, domain=workingDomain) {
    const ele = e.target;

    const res = await fetch('/get_redirs', {
        method: 'post',
        body: JSON.stringify(domain),
    });

    if (res.status == 200) {
        const resText = await res.text();
        return JSON.parse(resText);
    }
}


/**
 * Check both local config and remote redirs,
 * and return two lists :
 *  - list of local entries unknown from remote
 *  - list of remote entries unknown from local
 */
async function synCheck(e, domain=workingDomain) {
    let ele, btn;

    // Show modal window
    ele = doc.createElement('p');
    ele.innerText = "Loading...";
    synDialog.append(ele);

    synDialog.returnValue = null;
    synDialog.showModal();

    // Start sync
    const res = await fetch('/syn_check', {
        method: 'post',
        body: JSON.stringify(domain),
    });

    let resText = await res.text();
    resText = JSON.parse(resText);

    if (res.status == 200) {
        // Remote alias count
        ele.innerText = resText[0] + " aliases known in remote";

        // List of aliases unknown from remote
        if (resText[1].length > 0) {
            ele = doc.createElement('h2');
            ele.innerText = resText[1].length + " aliases unknown from remote :";
            synDialog.append(ele);
            
            for (const i of resText[1]) {
                ele = doc.createElement('p');
                ele.innerText = i;
                synDialog.append(ele);

                btn = doc.createElement('button');
                btn.name = "create-alias";
                btn.value = i;
                btn.innerText = "Create alias";
                btn.addEventListener('click', synAddAlias);
                ele.append(btn);

                btn = doc.createElement('button');
                btn.name = "delete-row";
                btn.value = i;
                btn.innerText = "Delete";
                btn.addEventListener('click', synDelAlias);
                ele.append(btn);
            }
        }

        // List of aliases unknown from local alias config
        if (resText[2].length > 0) {
            ele = doc.createElement('h2');
            ele.innerText = resText[2].length + " aliases unknown locally :";
            synDialog.append(ele);

            for (const [k, v] of resText[2].entries()) {
                ele = doc.createElement('p');
                ele.innerText = v;
                synDialog.append(ele);

                btn = doc.createElement('button');
                btn.innerText = "Add";
                btn.name = "remote-alias-id";
                btn.value = resText[2][k][0];
                btn.addEventListener('click', synAddAlias);
                ele.append(btn);

                btn = doc.createElement('button');
                btn.innerText = "Remove";
                btn.name = "remote-alias-id";
                btn.value = resText[2][k][0];
                btn.addEventListener('click', synDelAlias);
                ele.append(btn);
            }
        }

        btn = doc.createElement('button');
        btn.value = "cancel";
        btn.autofocus = true;
        btn.setAttribute("formmethod", "dialog");
        btn.innerText = "Cancel";
        btn.addEventListener('click', () => {
            synDialog.close();
        });
        synDialog.append(btn);
        
    } else {
        showInfobox("Error:\n" + resText);
    }
}


/**
 * Synchronisation : add alias
 */
async function synAddAlias() {
    switch (this.name) {
        // Create "locally known" alias in remote
        // The alias doesn't really exists yet,
        // so this actually creates the alias
        case "create-alias":
            const value = this.value.split(',');
            const oldId = value[0];
            const name = value[1];
            const alias = value[2];
            const to = value[3];

            // Create the redirection
            const newRedir = new Redir ("", name, "", alias, to);
            const res = await newRedir.create();
            const resText = JSON.parse(await res.text());

            if (res.status == 200) {
                // TODO update the row id and date
                const tr = doc.querySelector(`tr[id="${oldId}"]`);    
                const date = tr.querySelectorAll('time');
                tr.id = resText['id'];

                if (date[0].innerText == "") {
                    date[0].innerText = resText['date'];
                    convertEpoch([date]);
                }

                // Clear line from dialog
                this.parentElement.remove();

                showInfobox("Sync : alias created succesfully");
            } else {
                showInfobox("Sync : create error:\n" + resText);
            }

            break;
        
        // Create "remotely known" alias in local
        // The alias already exists and works,
        // so this just makes the app know the alias
        case "remote-alias-id":
            alert('TODO add existing alias localy : ' + this.value);
            break;
    
        default:
            break;
    }
}


/**
 * Synchronisation : delete alias
 */
async function synDelAlias() {
    const value = this.value.split(',');
    const id = value[0];
    const name = value[1];
    const alias = value[2];
    const to = value[3];

    // Delete redirection
    const newRedir = new Redir (id, name, "", alias, to);
    const res = await newRedir.remove();

    switch (this.name) {
        // Remove local entry/row
        case "delete-row":
            if (res.status == 200) {
                showInfobox("Local entry " + value[1] + " removed");

                // Remove row from table and modal
                for (const tr of tbody.querySelectorAll('tr')) {
                    if (tr.id == id) {
                        tr.remove();
                        this.parentElement.remove();
                    }
                }
            } else {
                showInfobox("An error occured while removing local entry :\n" + await res.text());
            }
            break;

        // Remove remote entry
        case "remote-alias-id":
            if (res.status == 200) {
                showInfobox("Remote entry " + value[1] + " removed");
                // Clear line from dialog
                this.parentElement.remove();
            } else {
                showInfobox("An error occured while removing remote entry :\n" + await res.text());
            }

        default:
            break;
    }
}


/**
 * Generate a random word from adjectives + nouns dictionnaries
 */
async function genName() {
    const res = await fetch('/gen_name', {
        method: 'post'
    });

    if (res.status == 200) {
        const resText = await res.text();
        return resText;
    }
}

/*
 *
 * ███████ ██    ██ ███████ ███    ██ ████████     ██      ██ ███████ ████████ ███████ ███    ██ ███████ ██████  ███████ 
 * ██      ██    ██ ██      ████   ██    ██        ██      ██ ██         ██    ██      ████   ██ ██      ██   ██ ██      
 * █████   ██    ██ █████   ██ ██  ██    ██        ██      ██ ███████    ██    █████   ██ ██  ██ █████   ██████  ███████ 
 * ██       ██  ██  ██      ██  ██ ██    ██        ██      ██      ██    ██    ██      ██  ██ ██ ██      ██   ██      ██ 
 * ███████   ████   ███████ ██   ████    ██        ███████ ██ ███████    ██    ███████ ██   ████ ███████ ██   ██ ███████ 
 *
 */

/**
 * Table : show/hide button
 */
showHideBtn.addEventListener('click', (e) => {
    if (redirList.classList.contains('fade-bottom')) {
        redirList.classList.remove('fade-bottom');
        redirList.style.height = '100%';
        showHideBtn.children[0].dataset.feather = "eye-off";
    }
    else {
        redirList.classList.add('fade-bottom');
        redirList.removeAttribute('style');
        showHideBtn.children[0].dataset.feather = "eye";
    }

    feather.replace();
});


/**
 * Table : New alias link button
 */
newAliasBtn.addEventListener('click', addRow);


/**
 * Save button : save new/edit alias operations made in table
 */
saveAliasBtn.addEventListener('click', saveAlias);


/**
 * Cancel button : cancel all "new" and/or "edit" alias operations in table
 */
cancelAliasBtn.addEventListener('click', (e) => {
    cancelAliasOperations();
});


/**
 * Domain select : change working domain
 * Update localstorage to remember current selection,
 * and update the table to show redirections
 * for selected domain only
 */
domainSelect.addEventListener('change', async (e) => {
    workingDomain = domainSelect.value;
    localStorage.setItem('workingDomain', workingDomain);

    const aliasData = await getAliasList(e, workingDomain);
    updateTable(aliasData);
});


/**
 * Destination address select : change default destination address
 * Update localstorage to remember current selection,
 */
destSelect.addEventListener('change', async (e) => {
    destAddr = destSelect.value;
    localStorage.setItem('destAddr', destAddr);
});


/**
 * Table refresh link button
 */
refreshBtn.addEventListener('click', async (e) => {
    const aliasData = await getAliasList(e, workingDomain);
    updateTable(aliasData);
});


/*
 * Sync remote button
 */
syncBtn.addEventListener('click', synCheck);


/**
 * Sync dialog box
 */
synDialog.addEventListener('close', () => {
    synDialog.innerHTML = "";
});


/**
 * Find/search in table input : typing something
 */
findInput.addEventListener('input', () => {
    const cnt = tbody.querySelectorAll('tr').length;
    let cntFiltered = cnt;

    // Hide all table's rows as user types...
    if (findInput.value.length > 0) {
        for (let i = 0, row; row = tbody.rows[i]; i++) {
            row.style.display = "none";
        }
    } else {
        for (let i = 0, row; row = tbody.rows[i]; i++) {
            row.style.display = "";
            redirCount.innerText = cnt;
        }
    }

    // ... and show the ones containing typed text
    for (let i = 0, row; row = tbody.rows[i]; i++) {
        for (let j = 0, col; col = row.cells[j]; j++) {
            if (findInput.value.length > 0 &&
                col.innerText.toLowerCase().includes(findInput.value.toLowerCase())) {
                row.style.display = "";
                cntFiltered = tbody.querySelectorAll('tr[style="display: none;"]').length;
                redirCount.innerText = cnt - cntFiltered;
            }
        }
    }
});


/**
 * Test btn
 */
const testBtn = doc.querySelector('#test-btn');
testBtn.addEventListener('click', (e) => {
    // const delBtns = doc.querySelectorAll('.btn-del');
    // const editBtns = doc.querySelectorAll('.btn-edit');
    // for (const btn of delBtns)
    //     btn.disabled = true;
    // for (const btn of editBtns)
    //     btn.disabled = true;

    const editedCells = tbody.querySelectorAll('td[contenteditable="true"]');
    let editRow;
    for (const td of editedCells) {
        editRow = td.parentElement.querySelector('td[data-alias-item="edit"]');
        editRow.innerHTML = '<div class="dot-flashing"></div>';

        td.setAttribute('style', 'color: var(--color-text-gray-1);');
    }

});


/**
 * On page load :
 *  - get last user parameters from local storage
 *  - fetch all locally known aliases and build table
 */
window.addEventListener('load', async (e) => {
    if (localStorage.getItem('workingDomain')) {
        workingDomain = localStorage.getItem('workingDomain');
        domainSelect.value = workingDomain;
    }

    if (localStorage.getItem('destAddr')) {
        destAddr = localStorage.getItem('destAddr');
        destSelect.value = destAddr;
    }
    
    const aliasData = await getAliasList(e, workingDomain);
    updateTable(aliasData);
});