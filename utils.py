# -*- encoding: utf-8 -*-
import ovh

def list_ovh_tokens(client: ovh.Client):
    result = client.get("/me/api/application")
    for id in result:
        token = client.get(f"/me/api/application/{id}")
        print(token)

def delete_ovh_token(client: ovh.Client, id: int):
    client.delete(f"/me/api/application/{id}")
    print(f"Token {id} have been deleted")

def purge_ovh_tokens(client: ovh.Client):
    result = client.get("/me/api/application")
    for id in result:
        token = client.delete(f"/me/api/application/{id}")
        print("All tokens have been deleted")