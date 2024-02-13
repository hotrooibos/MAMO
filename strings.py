# -*- encoding: utf-8 -*-

PROMPT_NAME = " (optional) Name/description ? "
PROMPT_HASH = " Use a hash (0) or readable (1) redir address ? [0/1] "
PROMPT_ALIAS = " Alias address ? "
PROMPT_DEST = " Destination address ? "

ERR_HASH = " Error, expected 0 or 1"

def err_not_valid_email(email: str) -> str:
    return f" {email} is not a valid e-mail format."

def cant_find_alias(email: str) -> str:
    return f" Could not find alias \"{email}\"."