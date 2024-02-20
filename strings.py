# -*- encoding: utf-8 -*-

PROMPT_NAME = " (optional) Name/description ? "
PROMPT_UUID = " Alias format : random UUID (0) or manual (1) ? [0/1] "
PROMPT_ALIAS = " Alias address ? "
PROMPT_DEST = " Destination address ? "
ERR_HASH = " Error, expected 0 or 1"
SYNCED_ENTRY_NAME = "Entry added automatically, sync'ed from remote."

def err_not_valid_email(email: str) -> str:
    return f" {email} is not a valid e-mail format."

def cant_find_alias(email: str) -> str:
    return f" Could not find alias \"{email}\"."