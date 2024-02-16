# -*- encoding: utf-8 -*-
import re
import readline

def is_valid_email(email: str) -> bool:
	'''
		Verify if email format is valid
	'''
	pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
	
	if re.match(pattern, email):
		return True
	else:
		return False
	

def input_w_prefill(prompt: str, text: str) -> input:
	'''
		Generate an input with prefilled text
	'''
	def hook():
		readline.insert_text(text)
		readline.redisplay()

	readline.set_pre_input_hook(hook)
	result = input(prompt)
	readline.set_pre_input_hook()
	return result