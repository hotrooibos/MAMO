const doc           = document;
const wrapper     = doc.querySelector('#wrapper');

const listRedir     = doc.querySelector('#listRedir');
const redirList     = doc.querySelector('#redirList');

const redirForm     = doc.querySelector('#redir_form');
const genUuid       = doc.querySelector('#gen_uuid');
const fieldAlias    = doc.querySelector('#alias');

const delForm       = doc.querySelector('#del_redir_form');
const fieldAliasDel = doc.querySelector('#id_del');

const listTest      = doc.querySelector('#listTest');
const testList      = doc.querySelector('#testList');


function showInfobox(msg) {
    let cnt = doc.querySelectorAll('.msgbox').length*3 + 1;
    let msgbox = doc.createElement('div');
    msgbox.setAttribute('id', 'msgbox');
    msgbox.setAttribute('class', 'msgbox');
    msgbox.innerHTML = msg;
    msgbox.style.top = cnt + "em";
    msgbox.style.right = "1em";
    doc.querySelector('body').appendChild(msgbox);

    setTimeout((e) => {
        doc.querySelector('.msgbox').remove();
    }, 5000);
}


function loadRedirs(jsonStr) {
    jsonObj = JSON.parse(jsonStr);

    redirList.innerHTML = "";

    r = [];

    for (const key of Object.keys(jsonObj)) { 
        // console.log(key + ": " + JSON.stringify(jsonObj[key]));
        r.push(key + ": " + JSON.stringify(jsonObj[key]));
    };

    let li = doc.createElement('li');
    li.innerHTML = "Alias count : " + r.length;
    redirList.appendChild(li);


    for (const item of r) {
        li = doc.createElement('li');
        li.innerHTML = item;
        redirList.appendChild(li);
    }
}


function fillAlias(aliasStr) {
    // texte du field "alias" = aliasStr
    fieldAlias.value = aliasStr;
}


function getRedirs() {
    eel.get_redirs()(loadRedirs);
}


async function setRedir(form) {
    showInfobox("Creating new redir...");

    const res = await eel.set_redir(form)();

    if (res == 0) {
        // eel.get_redirs();
        // redirForm.reset();
        showInfobox("Alias created succesfully !");
    } else {
        showInfobox("An error occured while creating the alias...");
    }
}


function getUuid() {
    showInfobox("Generating UUID...");
    eel.get_uuid()(fillAlias);
}


async function delRedir(form) {
    showInfobox("Removing a redir...");

    const res = await eel.del_redir(form)();

    if (res == 0) {
        showInfobox("Alias removed succesfully !");
        delForm.reset();
    } else {
        showInfobox("An error occured while removing the alias...");
    }

}


/*

Event listeners

*/

listRedir.addEventListener('click', (e) => {
    getRedirs();

    if (redirList.hasAttribute('style')) {
        redirList.removeAttribute('style');
    }
    else {
        redirList.style.display = 'none';
    }
});

genUuid.addEventListener('click', (e) => {
    getUuid();
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