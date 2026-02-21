package com.alivecor.testapp.rest;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.Header;
import retrofit2.http.POST;

/**
 * Example API Interface for authenticating with the SDK
 */
public interface ExampleApiInterface {

    // For PRODUCTION BASE URL
    @POST("token")
    Call<TokenResponse> token(@Body TokenRequest request);

    // For STAGING BASE URL
    @POST("sdk")
    Call<TokenResponse> token(@Header("Authorization") String authToken, @Body TokenRequest request);
}
