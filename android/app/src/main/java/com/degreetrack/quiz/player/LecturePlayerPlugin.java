package com.degreetrack.quiz.player;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LecturePlayer")
public class LecturePlayerPlugin extends Plugin {
    private static final String TAG = "LecturePlayerPlugin";

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "[DegreeTrack] LecturePlayerPlugin loaded successfully into Capacitor Bridge!");
    }

    @PluginMethod
    public void isNativePlayerAvailable(PluginCall call) {
        Log.d(TAG, "[DegreeTrack] isNativePlayerAvailable called from JS bridge -> returning available=true");
        JSObject ret = new JSObject();
        ret.put("available", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void playLecture(PluginCall call) {
        Log.d(TAG, "[DegreeTrack] playLecture invoked with data: " + (call.getData() != null ? call.getData().toString() : "null"));

        String fileId = call.getString("fileId");
        String videoUrl = call.getString("videoUrl");
        String accessToken = call.getString("accessToken");
        String title = call.getString("title", "Lecture Video");
        String courseTitle = call.getString("courseTitle", "DegreeTrack");
        String topicId = call.getString("topicId", "");
        Double currentTime = call.getDouble("currentTime", 0.0);
        Double duration = call.getDouble("duration", 0.0);
        Boolean isOffline = call.getBoolean("isOffline", false);

        JSObject nextTopic = call.getObject("nextTopic");

        Log.d(TAG, "[DegreeTrack] Starting LecturePlayerActivity Intent: fileId=" + fileId +
                ", videoUrl=" + videoUrl +
                ", hasAccessToken=" + (accessToken != null && !accessToken.trim().isEmpty()) +
                ", title=" + title +
                ", courseTitle=" + courseTitle +
                ", topicId=" + topicId +
                ", currentTime=" + currentTime +
                ", duration=" + duration +
                ", isOffline=" + isOffline);

        Intent intent = new Intent(getContext(), LecturePlayerActivity.class);
        intent.putExtra("fileId", fileId);
        intent.putExtra("videoUrl", videoUrl);
        intent.putExtra("accessToken", accessToken);
        intent.putExtra("title", title);
        intent.putExtra("courseTitle", courseTitle);
        intent.putExtra("topicId", topicId);
        intent.putExtra("currentTime", currentTime != null ? currentTime : 0.0);
        intent.putExtra("duration", duration != null ? duration : 0.0);
        intent.putExtra("isOffline", isOffline != null ? isOffline : false);

        if (nextTopic != null) {
            intent.putExtra("nextTopicId", nextTopic.getString("topicId"));
            intent.putExtra("nextTitle", nextTopic.getString("title"));
            intent.putExtra("nextVideoUrl", nextTopic.getString("videoUrl"));
            intent.putExtra("nextFileId", nextTopic.getString("fileId"));
            Log.d(TAG, "[DegreeTrack] Next lecture configured: " + nextTopic.getString("title"));
        }

        try {
            startActivityForResult(call, intent, "lecturePlayerResult");
            Log.d(TAG, "[DegreeTrack] startActivityForResult launched for LecturePlayerActivity");
        } catch (Exception e) {
            Log.e(TAG, "[DegreeTrack] Failed to start LecturePlayerActivity:", e);
            call.reject("Failed to start LecturePlayerActivity: " + e.getMessage());
        }
    }

    @ActivityCallback
    public void lecturePlayerResult(PluginCall call, ActivityResult result) {
        Log.d(TAG, "[DegreeTrack] lecturePlayerResult callback received resultCode=" + (result != null ? result.getResultCode() : "null"));
        if (call == null) {
            Log.w(TAG, "[DegreeTrack] lecturePlayerResult: call is null!");
            return;
        }

        JSObject ret = new JSObject();
        if (result != null && result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Intent data = result.getData();
            double curTime = data.getDoubleExtra("currentTime", 0.0);
            double dur = data.getDoubleExtra("duration", 0.0);
            boolean completed = data.getBooleanExtra("isCompleted", false);
            int watchedPct = data.getIntExtra("watchedPercentage", 0);
            boolean nextReq = data.getBooleanExtra("nextRequested", false);
            String nextTopId = data.getStringExtra("nextTopicId");

            Log.d(TAG, "[DegreeTrack] Playback result returned: topicId=" + data.getStringExtra("topicId") +
                    ", currentTime=" + curTime +
                    ", duration=" + dur +
                    ", isCompleted=" + completed +
                    ", watchedPct=" + watchedPct + "%" +
                    ", nextRequested=" + nextReq);

            ret.put("topicId", data.getStringExtra("topicId"));
            ret.put("currentTime", curTime);
            ret.put("duration", dur);
            ret.put("isCompleted", completed);
            ret.put("watchedPercentage", watchedPct);
            ret.put("nextRequested", nextReq);
            ret.put("nextTopicId", nextTopId);

            String notesJsonStr = data.getStringExtra("notesAddedJson");
            if (notesJsonStr != null && !notesJsonStr.isEmpty()) {
                try {
                    ret.put("notesAdded", new JSArray(notesJsonStr));
                } catch (Exception ignored) {
                    ret.put("notesAdded", new JSArray());
                }
            } else {
                ret.put("notesAdded", new JSArray());
            }
        } else {
            Log.d(TAG, "[DegreeTrack] LecturePlayerActivity exited or cancelled without RESULT_OK");
            ret.put("cancelled", true);
        }

        call.resolve(ret);
    }
}
