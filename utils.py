# -*- encoding: utf-8 -*-
import re

def is_valid_email(email: str) -> bool:
	'''
		Verify if email format is valid
	'''
	pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
	
	if re.match(pattern, email):
		return True
	else:
		return False