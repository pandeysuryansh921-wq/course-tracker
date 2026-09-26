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
    private static final String TAG = "DegreeTrackPlayer";

    @Override
    public void load() {
        super.load();
        Log.i(TAG, "[DegreeTrack] LecturePlayerPlugin loaded successfully into Capacitor Bridge!");
    }

    @PluginMethod
    public void isNativePlayerAvailable(PluginCall call) {
        Log.i(TAG, "[PLAYER_TRACE_05] LecturePlayerPlugin.isNativePlayerAvailable called from JS -> returning true");
        JSObject ret = new JSObject();
        ret.put("available", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void playLecture(PluginCall call) {
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

        int tokenLength = (accessToken != null) ? accessToken.trim().length() : 0;
        String tokenPrefix = (tokenLength > 6) ? accessToken.trim().substring(0, 6) + "..." : "none";

        Log.i(TAG, "[PLAYER_TRACE_09] LecturePlayerPlugin.playLecture() received: " +
                "fileId=" + fileId +
                ", title=" + title +
                ", courseTitle=" + courseTitle +
                ", topicId=" + topicId +
                ", isOffline=" + isOffline +
                ", hasToken=" + (tokenLength > 0) +
                ", tokenPrefix=" + tokenPrefix +
                ", tokenLength=" + tokenLength +
                ", currentTime=" + currentTime);

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
            Log.i(TAG, "[PLAYER_TRACE_09] Up next configured: " + nextTopic.getString("title"));
        }

        try {
            Log.i(TAG, "[PLAYER_TRACE_10] Creating Intent and launching LecturePlayerActivity via startActivityForResult");
            startActivityForResult(call, intent, "lecturePlayerResult");
            Log.i(TAG, "[PLAYER_TRACE_10] startActivityForResult dispatched successfully");
        } catch (Exception e) {
            Log.e(TAG, "[PLAYER_TRACE_10] Failed to start LecturePlayerActivity: " + e.getMessage(), e);
            call.reject("Failed to start LecturePlayerActivity: " + e.getMessage());
        }
    }

    @ActivityCallback
    public void lecturePlayerResult(PluginCall call, ActivityResult result) {
        int resultCode = (result != null) ? result.getResultCode() : Activity.RESULT_CANCELED;
        Log.i(TAG, "[PLAYER_TRACE_20] LecturePlayerPlugin.lecturePlayerResult received resultCode=" + resultCode);

        if (call == null) {
            Log.w(TAG, "[PLAYER_TRACE_20] lecturePlayerResult: call is null!");
            return;
        }

        JSObject ret = new JSObject();
        if (result != null && result.getData() != null) {
            Intent data = result.getData();
            boolean hasError = data.getBooleanExtra("hasError", false);

            if (hasError) {
                String errMsg = data.getStringExtra("errorMessage");
                int errCode = data.getIntExtra("errorCode", -1);
                String errCodeName = data.getStringExtra("errorCodeName");
                int httpStatus = data.getIntExtra("httpStatus", -1);
                String errDetails = data.getStringExtra("errorDetails");

                Log.e(TAG, "[PLAYER_TRACE_20] Playback returned failure: " + errMsg + " (code: " + errCodeName + ", http: " + httpStatus + ")");
                ret.put("hasError", true);
                ret.put("errorMessage", errMsg);
                ret.put("errorCode", errCode);
                ret.put("errorCodeName", errCodeName);
                ret.put("httpStatus", httpStatus);
                ret.put("errorDetails", errDetails);
            } else if (resultCode == Activity.RESULT_OK) {
                double curTime = data.getDoubleExtra("currentTime", 0.0);
                double dur = data.getDoubleExtra("duration", 0.0);
                boolean completed = data.getBooleanExtra("isCompleted", false);
                int watchedPct = data.getIntExtra("watchedPercentage", 0);
                boolean nextReq = data.getBooleanExtra("nextRequested", false);
                String nextTopId = data.getStringExtra("nextTopicId");

                Log.i(TAG, "[PLAYER_TRACE_20] Playback result: topicId=" + data.getStringExtra("topicId") +
                        ", currentTime=" + curTime +
                        ", duration=" + dur +
                        ", isCompleted=" + completed +
                        ", watchedPct=" + watchedPct + "%" +
                        ", nextRequested=" + nextReq);

                ret.put("hasError", false);
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
                Log.i(TAG, "[PLAYER_TRACE_20] LecturePlayerActivity closed or cancelled by user");
                ret.put("cancelled", true);
                ret.put("hasError", false);
            }
        } else {
            Log.i(TAG, "[PLAYER_TRACE_20] Activity finished with no result data");
            ret.put("cancelled", true);
            ret.put("hasError", false);
        }

        call.resolve(ret);
    }
}
