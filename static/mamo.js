const doc           = document;
const wrapper       = doc.querySelector('#wrapper');

const showHide      = doc.querySelector('#showHide');
const findInput     = doc.querySelector('#find');
const redirList     = doc.querySelector('#redir-list');
const redirTab      = doc.querySelector('#redir-tab');
const btnsDel       = doc.querySelectorAll('.btn-del');
const btnsEdit      = doc.querySelectorAll('.btn-edit');

const redirForm     = doc.querySelector('#redir_form');
const genUuid       = doc.querySelector('#gen_uuid');
const fieldAlias    = doc.querySelector('#alias');

const delForm       = doc.querySelector('#del_redir_form');
const fieldAliasDel = doc.querySelector('#id_del');

const dialogDel     = doc.querySelector('#dialog-del');


// const listTest      = doc.querySelector('#listTest');
// const testList      = doc.querySelector('#testList');



function showInfobox(msg) {
    var boxesArr = doc.querySelectorAll('.msgbox');

    // Move down msg boxes actually displayed
    for (let i = 0; i < boxesArr.length; i++) {
        const box = boxesArr[i];
        box.style.top = (parseFloat(box.style.top) + 4) + "em";
    }

    // Create the new box on the top
    let newBox = doc.createElement('div');
    newBox.setAttribute('id', 'msgbox');
    newBox.setAttribute('class', 'msgbox');
    newBox.innerHTML = msg;
    newBox.style.top = "1em";
    wrapper.appendChild(newBox);

    // Schedule the new box to be removed after 5s
    setTimeout((e) => {
        doc.querySelector('.msgbox').remove();
    }, 5000);
}


// function loadRedirs(jsonStr) {
//     jsonObj = JSON.parse(jsonStr);
//     redirList.innerHTML = "";
//     r = [];

//     for (const key of Object.keys(jsonObj)) { 
//         // console.log(key + ": " + JSON.stringify(jsonObj[key]));
//         r.push(key + ": " + JSON.stringify(jsonObj[key]));
//     };

//     let li = doc.createElement('li');
//     li.innerHTML = "Alias count : " + r.length;
//     redirList.appendChild(li);

//     for (const item of r) {
//         li = doc.createElement('li');
//         li.innerHTML = item;
//         redirList.appendChild(li);
//     }
// }


async function setRedir(form) {
    showInfobox("Creating new redir...");

    fetch('/set_redir', {
        method: 'post',
        body: form,
    })
    .then(response => response.status)  
    .then(status => {
        if (status == 200) {
            // get_redirs();
            // redirForm.reset();
            showInfobox("Alias created succesfully !");
        } else {
            showInfobox("An error occured while creating the alias...");
        }
    });
}

async function delRedir(form) {
    showInfobox("Removing a redir...");

    fetch('/del_redir', {
        method: 'post',
        body: form,
    })
    .then(response => response.status)  
    .then(status => {
        if (status == 200) {
            showInfobox("Alias removed succesfully !");
        } else {
            showInfobox("An error occured while removing the alias...");
        }
    });
}


/*

Event listeners

*/

showHide.addEventListener('click', (e) => {
    // getRedirs();

    if (redirList.hasAttribute('class')) {
        redirList.removeAttribute('class');
        redirList.style.height = '100%';
    }
    else {
        redirList.setAttribute('class', 'fade-bottom');
        redirList.removeAttribute('style');
    }
});

btnsDel.forEach(ele => ele.addEventListener('click', (e) => {
    e.preventDefault();
    let id = ele.parentElement.closest('tr').id;
    let dialogText = "Remove id " + id + " ?";
    dialogDel.querySelector('p').innerHTML = dialogText;
    dialogDel.showModal();
}));

// Function used to lock editable cells (<td>)
// as soon as the user click anywhere out of the
// row currently edited
function lockRow(e) {
    // Identify currently clicked element
    let ele = e.target;
    let trParent = ele.closest('tr');

    // If click event happened anywhere but on
    // the currently edited row elements: 
    // - Process the content modification
    // - Terminate table edition
    // - Remove the click listener triggering this function
    if (!trParent || !trParent.hasAttribute('edition')) {
        // Identify row/cells under edition
        let editedTr = doc.querySelector('tr[edition]');
        let editedTdArr = doc.querySelectorAll('td[contenteditable]');

        // Process content modification
        // Get content from edited cells
        const editedContent = {};

        editedTdArr.forEach((tdItem, index) => {
            aliasItem = tdItem.dataset.aliasItem;
            editedContent[aliasItem] = tdItem.innerHTML;
        });

        let editedMsg = JSON.stringify(editedContent);
        showInfobox(editedMsg);
        
        // Remove the table edition
        editedTr.removeAttribute('edition');

        editedTdArr.forEach((tdItem, index) => {
            tdItem.removeAttribute('contenteditable','');
            tdItem.removeAttribute('class');
        });

        window.removeEventListener('click', lockRow);
    }
}

function editRow(e) {
    e.preventDefault();
    let ele = e.target;
    let parent = ele.parentElement.closest('tr');
    let tdArr = parent.querySelectorAll('td');

    // TODO s'il existe des cells editable, clore leur edition avant d'ouvrir
    // cette nouvelle edition
    let editedTr = doc.querySelector('tr[edition]');
    let editedTdArr = doc.querySelectorAll('td[contenteditable]');

    if (editedTr) {
        // Remove the table edition
        editedTr.removeAttribute('edition');

        editedTdArr.forEach((tdItem, index) => {
            tdItem.removeAttribute('contenteditable','');
            tdItem.removeAttribute('class');
        });
    }

    parent.setAttribute('edition', '');

    // Make useful cells' (<td>) content
    // editable for the edited row
    tdArr.forEach((arrayItem, index) => {
        switch (index) {
            case 0:
            case 2:
            case 3:
                arrayItem.setAttribute('contenteditable','');
                arrayItem.setAttribute('class', 'td-editable');
                break;
            default:
                break;
        }
    });

    window.addEventListener("click", lockRow);
}

btnsEdit.forEach(ele => ele.addEventListener('click', editRow));

dialogDel.addEventListener('close', (e) => {
    if (dialogDel.returnValue === "yes") {
        console.log("TODO : delete alias");
    }
});

findInput.addEventListener('input', (e) => {
    if (findInput.value.length > 0) {
        for (let i = 1, row; row = redirTab.rows[i]; i++) {
            row.style.display = "none";
        }
    } else {
        for (let i = 0, row; row = redirTab.rows[i]; i++) {
            row.removeAttribute('style');
        }
    }

    for (var i = 1, row; row = redirTab.rows[i]; i++) {
        for (var j = 0, col; col = row.cells[j]; j++) {
            if (findInput.value.length > 1 && col.innerHTML.includes(findInput.value)) {
                row.removeAttribute('style');
            }
        }  
    }
});

genUuid.addEventListener('click', (e) => {
    e.preventDefault();
    showInfobox("Generating UUID...");
    fetch('/get_uuid')
    .then(response => response.text())  
    .then(text => fieldAlias.value = text);
});

redirForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let newRedirForm = new FormData(redirForm);
    newRedirForm = JSON.stringify(Object.fromEntries(newRedirForm));
    setRedir(newRedirForm);
});

delForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let newDelForm = new FormData(delForm);
    newDelForm = JSON.stringify(Object.fromEntries(newDelForm));
    delRedir(newDelForm);
});



// // Tests
// var testDict = {
//     "001": {
//         "name": "Test",
//         "date": "",
//         "alias": "001@tical.fr",
//         "to": "antoine@marzin.org"
//     },
//     "002": {
//         "name": "",
//         "date": "",
//         "alias": "002@tical.fr",
//         "to": "antoine@marzin.org"
//     }
// }

// listTest.addEventListener('click', (e) => {
//     console.log('Type : ' + typeof(testDict));

//     for (const key of Object.keys(testDict)) { 
//         console.log(key + ": " + JSON.stringify(testDict[key])); 
//      };
// });