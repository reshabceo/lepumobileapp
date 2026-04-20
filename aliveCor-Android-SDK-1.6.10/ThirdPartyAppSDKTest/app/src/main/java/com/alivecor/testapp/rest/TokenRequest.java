package com.alivecor.testapp.rest;

import com.google.gson.annotations.SerializedName;

public class TokenRequest {
    @SerializedName("bundleId") String bundleId;
    @SerializedName("patientMrn") String patientMrn;
    @SerializedName("teamId") String teamId;
    @SerializedName("partnerId") String partnerId;
    @SerializedName("userId") String userId;

    public String getPartnerId() {
        return partnerId;
    }

    public void setPartnerId(String partnerId) {
        this.partnerId = partnerId;
    }

    public String getBundleId() {
        return bundleId;
    }

    public void setBundleId(String bundleId) {
        this.bundleId = bundleId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getPatientMrn() {
        return patientMrn;
    }

    public void setPatientMrn(String patientMrn) {
        this.patientMrn = patientMrn;
    }

    public String getTeamId() {
        return teamId;
    }

    public void setTeamId(String teamId) {
        this.teamId = teamId;
    }
}
