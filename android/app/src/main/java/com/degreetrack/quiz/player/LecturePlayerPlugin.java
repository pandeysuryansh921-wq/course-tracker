package com.degreetrack.quiz.player;

import android.app.Activity;
import android.content.Intent;

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

    @PluginMethod
    public void isNativePlayerAvailable(PluginCall call) {
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
        }

        startActivityForResult(call, intent, "lecturePlayerResult");
    }

    @ActivityCallback
    private void lecturePlayerResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        JSObject ret = new JSObject();
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Intent data = result.getData();
            ret.put("topicId", data.getStringExtra("topicId"));
            ret.put("currentTime", data.getDoubleExtra("currentTime", 0.0));
            ret.put("duration", data.getDoubleExtra("duration", 0.0));
            ret.put("isCompleted", data.getBooleanExtra("isCompleted", false));
            ret.put("watchedPercentage", data.getIntExtra("watchedPercentage", 0));
            ret.put("nextRequested", data.getBooleanExtra("nextRequested", false));
            ret.put("nextTopicId", data.getStringExtra("nextTopicId"));

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
            ret.put("cancelled", true);
        }

        call.resolve(ret);
    }
}
