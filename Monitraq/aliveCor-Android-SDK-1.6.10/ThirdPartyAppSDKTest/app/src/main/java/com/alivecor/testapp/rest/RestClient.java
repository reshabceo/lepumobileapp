package com.alivecor.testapp.rest;

import okhttp3.HttpUrl;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class RestClient {

    // private static final String PROD_BASE_URL = "https://alivecor.azurewebsites.net/";

    private static final String PROD_BASE_URL = "https://us-kardia-production.alivecor.com/auth/";
    private static final String STAGING_BASE_URL = "https://us-kardia-staging.alivecor.com/auth/";

    private static final String BASE_URL = STAGING_BASE_URL;

    public ExampleApiInterface getApi() {
        return buildRetrofit().create(ExampleApiInterface.class);
    }

    private Retrofit buildRetrofit() {
        return new Retrofit.Builder()
                .addConverterFactory(GsonConverterFactory.create())
                .baseUrl(HttpUrl.parse(BASE_URL))
                .build();
    }
}
