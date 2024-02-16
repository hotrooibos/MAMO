const doc       = document;
const listRedir = doc.querySelector('#listRedir');
const redirList = doc.querySelector('#redirList');

function displayRedirList(n) {
    redirList.innerHTML = n;
}

function getRedirList() {
    eel.get_redir_list()(displayRedirList);
}

listRedir.addEventListener('click', (e) => {
    getRedirList();
});