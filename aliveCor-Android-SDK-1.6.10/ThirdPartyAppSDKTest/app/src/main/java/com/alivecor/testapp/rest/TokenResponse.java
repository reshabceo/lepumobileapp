package com.alivecor.testapp.rest;

public class TokenResponse {
    String jwt;

    public String getJwt() {
        return jwt;
    }

    public void setJwt(String jwt) {
        this.jwt = jwt;
    }

    @Override
    public String toString() {
        return "TokenResponse{" +
                "jwt='" + jwt + '\'' +
                '}';
    }
}
