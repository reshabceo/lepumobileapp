// Firebase Integration for Lepu Medical Devices
// Replace Node.js backend with Firebase

package com.example.lpdemo.firebase

import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.Timestamp
import kotlinx.coroutines.tasks.await

// 🔐 Authentication Service
class FirebaseAuthService {
    private val auth = FirebaseAuth.getInstance()
    
    fun getCurrentUser(): FirebaseUser? = auth.currentUser
    
    suspend fun loginPatient(email: String, password: String): Result<FirebaseUser> {
        return try {
            val result = auth.signInWithEmailAndPassword(email, password).await()
            Result.success(result.user!!)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun registerPatient(email: String, password: String, patientInfo: PatientProfile): Result<FirebaseUser> {
        return try {
            val result = auth.createUserWithEmailAndPassword(email, password).await()
            val user = result.user!!
            
            // Save patient profile
            FirebaseMedicalDataService().savePatientProfile(user.uid, patientInfo)
            
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun logout() = auth.signOut()
}

// 📊 Medical Data Service
class FirebaseMedicalDataService {
    private val db = FirebaseFirestore.getInstance()
    private val TAG = "FirebaseMedicalData"
    
    // Patient Profile
    suspend fun savePatientProfile(patientId: String, profile: PatientProfile) {
        try {
            db.collection("patients")
                .document(patientId)
                .set(profile)
                .await()
            Log.d(TAG, "Patient profile saved")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save patient profile", e)
        }
    }
    
    // 🩺 Blood Pressure
    suspend fun saveBPMeasurement(measurement: BloodPressureMeasurement) {
        val patientId = FirebaseAuth.getInstance().currentUser?.uid ?: return
        
        try {
            db.collection("patients")
                .document(patientId)
                .collection("measurements")
                .document("bp")
                .collection("records")
                .add(measurement)
                .await()
            Log.d(TAG, "BP measurement saved: ${measurement.systolic}/${measurement.diastolic}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save BP measurement", e)
        }
    }
    
    fun getRealtimeBPData(callback: (List<BloodPressureMeasurement>) -> Unit): ListenerRegistration {
        val patientId = FirebaseAuth.getInstance().currentUser?.uid ?: throw IllegalStateException("No authenticated user")
        
        return db.collection("patients")
            .document(patientId)
            .collection("measurements")
            .document("bp")
            .collection("records")
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .limit(50)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error listening to BP data", error)
                    return@addSnapshotListener
                }
                
                val measurements = snapshot?.documents?.mapNotNull { 
                    try {
                        it.toObject(BloodPressureMeasurement::class.java)
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing BP measurement", e)
                        null
                    }
                } ?: emptyList()
                
                callback(measurements)
            }
    }
    
    // 📈 ECG Data
    suspend fun saveECGMeasurement(measurement: ECGMeasurement) {
        val patientId = FirebaseAuth.getInstance().currentUser?.uid ?: return
        
        try {
            db.collection("patients")
                .document(patientId)
                .collection("measurements")
                .document("ecg")
                .collection("records")
                .add(measurement)
                .await()
            Log.d(TAG, "ECG measurement saved: ${measurement.heartRate} BPM")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save ECG measurement", e)
        }
    }
    
    fun getRealtimeECGData(callback: (List<ECGMeasurement>) -> Unit): ListenerRegistration {
        val patientId = FirebaseAuth.getInstance().currentUser?.uid ?: throw IllegalStateException("No authenticated user")
        
        return db.collection("patients")
            .document(patientId)
            .collection("measurements")
            .document("ecg")
            .collection("records")
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .limit(20)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error listening to ECG data", error)
                    return@addSnapshotListener
                }
                
                val measurements = snapshot?.documents?.mapNotNull { 
                    it.toObject(ECGMeasurement::class.java)
                } ?: emptyList()
                
                callback(measurements)
            }
    }
    
    // 🫁 Pulse Oximeter
    suspend fun saveOximeterMeasurement(measurement: OximeterMeasurement) {
        val patientId = FirebaseAuth.getInstance().currentUser?.uid ?: return
        
        try {
            db.collection("patients")
                .document(patientId)
                .collection("measurements")
                .document("oximeter")
                .collection("records")
                .add(measurement)
                .await()
            Log.d(TAG, "Oximeter measurement saved: SpO2 ${measurement.spo2}%, HR ${measurement.heartRate}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save oximeter measurement", e)
        }
    }
    
    fun getRealtimeOximeterData(callback: (List<OximeterMeasurement>) -> Unit): ListenerRegistration {
        val patientId = FirebaseAuth.getInstance().currentUser?.uid ?: throw IllegalStateException("No authenticated user")
        
        return db.collection("patients")
            .document(patientId)
            .collection("measurements")
            .document("oximeter")
            .collection("records")
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .limit(50)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error listening to oximeter data", error)
                    return@addSnapshotListener
                }
                
                val measurements = snapshot?.documents?.mapNotNull { 
                    it.toObject(OximeterMeasurement::class.java)
                } ?: emptyList()
                
                callback(measurements)
            }
    }
    
    // 🩸 Blood Glucose
    suspend fun saveGlucoseMeasurement(measurement: GlucoseMeasurement) {
        val patientId = FirebaseAuth.getInstance().currentUser?.uid ?: return
        
        try {
            db.collection("patients")
                .document(patientId)
                .collection("measurements")
                .document("glucose")
                .collection("records")
                .add(measurement)
                .await()
            Log.d(TAG, "Glucose measurement saved: ${measurement.glucose} ${measurement.unit}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save glucose measurement", e)
        }
    }
    
    fun getRealtimeGlucoseData(callback: (List<GlucoseMeasurement>) -> Unit): ListenerRegistration {
        val patientId = FirebaseAuth.getInstance().currentUser?.uid ?: throw IllegalStateException("No authenticated user")
        
        return db.collection("patients")
            .document(patientId)
            .collection("measurements")
            .document("glucose")
            .collection("records")
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .limit(50)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error listening to glucose data", error)
                    return@addSnapshotListener
                }
                
                val measurements = snapshot?.documents?.mapNotNull { 
                    it.toObject(GlucoseMeasurement::class.java)
                } ?: emptyList()
                
                callback(measurements)
            }
    }
    
    // 📊 Get All Recent Measurements
    suspend fun getAllRecentMeasurements(): PatientMeasurements {
        val patientId = FirebaseAuth.getInstance().currentUser?.uid ?: throw IllegalStateException("No authenticated user")
        
        return try {
            val bpTask = db.collection("patients").document(patientId)
                .collection("measurements").document("bp").collection("records")
                .orderBy("timestamp", Query.Direction.DESCENDING).limit(10).get()
            
            val ecgTask = db.collection("patients").document(patientId)
                .collection("measurements").document("ecg").collection("records")
                .orderBy("timestamp", Query.Direction.DESCENDING).limit(10).get()
            
            val oximeterTask = db.collection("patients").document(patientId)
                .collection("measurements").document("oximeter").collection("records")
                .orderBy("timestamp", Query.Direction.DESCENDING).limit(10).get()
            
            val glucoseTask = db.collection("patients").document(patientId)
                .collection("measurements").document("glucose").collection("records")
                .orderBy("timestamp", Query.Direction.DESCENDING).limit(10).get()
            
            val bpData = bpTask.await().documents.mapNotNull { it.toObject(BloodPressureMeasurement::class.java) }
            val ecgData = ecgTask.await().documents.mapNotNull { it.toObject(ECGMeasurement::class.java) }
            val oximeterData = oximeterTask.await().documents.mapNotNull { it.toObject(OximeterMeasurement::class.java) }
            val glucoseData = glucoseTask.await().documents.mapNotNull { it.toObject(GlucoseMeasurement::class.java) }
            
            PatientMeasurements(
                bloodPressure = bpData,
                ecg = ecgData,
                oximeter = oximeterData,
                glucose = glucoseData
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get all measurements", e)
            PatientMeasurements()
        }
    }
}

// 📱 Data Models
data class PatientProfile(
    val name: String = "",
    val age: Int = 0,
    val gender: String = "",
    val medicalId: String = "",
    val emergencyContact: String = "",
    val createdAt: Timestamp = Timestamp.now()
)

data class BloodPressureMeasurement(
    val systolic: Int = 0,
    val diastolic: Int = 0,
    val heartRate: Int = 0,
    val deviceModel: String = "",
    val deviceId: String = "",
    val timestamp: Timestamp = Timestamp.now(),
    val quality: String = "good" // good, fair, poor
)

data class ECGMeasurement(
    val heartRate: Int = 0,
    val rrInterval: Int = 0,
    val qrsWidth: Int = 0,
    val waveformData: List<Float> = emptyList(), // Simplified for Firestore
    val deviceModel: String = "",
    val deviceId: String = "",
    val timestamp: Timestamp = Timestamp.now(),
    val duration: Int = 30 // seconds
)

data class OximeterMeasurement(
    val spo2: Int = 0, // Oxygen saturation percentage
    val heartRate: Int = 0,
    val perfusionIndex: Float = 0f,
    val deviceModel: String = "",
    val deviceId: String = "",
    val timestamp: Timestamp = Timestamp.now()
)

data class GlucoseMeasurement(
    val glucose: Float = 0f,
    val unit: String = "mg/dL", // mg/dL or mmol/L
    val deviceModel: String = "",
    val deviceId: String = "",
    val timestamp: Timestamp = Timestamp.now(),
    val beforeAfterMeal: String = "before" // before, after
)

data class PatientMeasurements(
    val bloodPressure: List<BloodPressureMeasurement> = emptyList(),
    val ecg: List<ECGMeasurement> = emptyList(),
    val oximeter: List<OximeterMeasurement> = emptyList(),
    val glucose: List<GlucoseMeasurement> = emptyList()
)