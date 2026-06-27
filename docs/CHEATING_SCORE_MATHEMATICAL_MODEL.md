# The Mathematical and Algorithmic Formulation of Real-Time Cheating Risk Scoring in Online Proctoring Systems

## Abstract
In web-based educational proctoring systems, analyzing continuous streams of multi-sensor telemetry (e.g., eye-gaze tracking, facial detection, tab state, and head movement) is a primary challenge. Simple binary triggers generate high false-positive rates due to transient, non-malicious user behaviors (e.g., a student looking away to sneeze, a temporary lighting shift, or a sudden noise). Conversely, simple cumulative counters over-penalize early infractions and fail to capture current user behavior. 

This paper presents the mathematical model and system architecture of the **Severity-Weighted Exponentially Decayed Cheating Scorer**. By modeling cheating risk as a superposition of time-decayed impulses, the algorithm naturally filters transient noise while compounding sustained, multi-source violations. The system also implements a monotonic peak-tracking algorithm to prevent strategic evasion. We prove the model's structural properties, document its canonical taxonomy, and describe its distributed client-server execution model.

---

## 1. Introduction & Design Requirements

Real-time automated proctoring aims to preserve academic integrity without inducing undue stress on students or overwhelming instructors with false-positive alerts. Sensor suites capture diverse high-frequency telemetry, including:
* **Visual Telemetry:** Gaze deviation, eyes closed, excessive blinking, rapid eye movement, head-pose extreme rotations, multiple faces, face missing, and face-camera distance anomalies.
* **Environment Telemetry:** Detected peripherals (phones, headphones).
* **System Telemetry:** Browser tab focus loss, window minimization, or IP address changes.

To transform these raw signals into actionable, high-fidelity risk indicators, the scoring engine must satisfy four key requirements:
1. **Noise Tolerance (Temporal Relevance):** A brief, isolated infraction must not permanently penalize a student. Its contribution to the active cheating risk must decay over time.
2. **Cumulative Compounding:** Multiple concurrent or rapid successive infractions must accumulate, pushing the score into high risk levels faster than isolated ones.
3. **Evasion Resistance (Peak Monotonicity):** Students must not be able to bypass security by committing heavy infractions, waiting for the score to decay, and then submitting. The system must capture the highest risk state reached.
4. **Authoritative Consistency:** The client-side interface and instructor dashboard must display identical scores. Thus, the score calculation must have a single authoritative source of truth.

---

## 2. Mathematical Formulation

Let $\mathcal{S}$ represent an active examination session. Let $\mathcal{V}$ be the set of all validated violation events recorded during $\mathcal{S}$:

$$\mathcal{V} = \{ e_1, e_2, \dots, e_n \}$$

Each violation event $e_i$ is formally defined as a tuple:

$$e_i = (t_i, v_i, w_i)$$

where:
* $t_i \in \mathbb{R}^+$ is the server-recorded timestamp of the event (represented as epoch seconds).
* $v_i \in \mathcal{T}$ is the violation category from the canonical taxonomy $\mathcal{T}$.
* $w_i = \text{Severity}(v_i) \in \mathbb{R}^+$ is the static numeric weight (severity points) assigned to category $v_i$.

### 2.1 The Instantaneous (Live) Cheating Score
Let $t_{\text{now}}$ be the current evaluation timestamp, such that $t_{\text{now}} \ge t_i$ for all recorded events. The instantaneous cheating score $S(t_{\text{now}})$ is defined as:

$$S(t_{\text{now}}) = \min \left( S_{\max}, \sum_{e_i \in \mathcal{V}} w_i \cdot 2^{-\frac{t_{\text{now}} - t_i}{\tau}} \right)$$

where:
* $S_{\max} = 100$ is the upper bound of the scoring scale.
* $\tau \in \mathbb{R}^+$ is the half-life decay parameter (configured to $\tau = 60.0 \text{ seconds}$ in production).
* $\Delta t_i = t_{\text{now}} - t_i \ge 0$ is the elapsed time since the infraction occurred.

### 2.2 Equivalence to Continuous Exponential Decay
The base-2 representation is mathematically equivalent to the standard physical formulation of exponential decay. Let $\lambda$ be the decay constant:

$$2^{-\frac{\Delta t}{\tau}} = e^{-\lambda \Delta t}$$

Taking the natural logarithm of both sides:

$$-\frac{\Delta t}{\tau} \ln(2) = -\lambda \Delta t \implies \lambda = \frac{\ln(2)}{\tau}$$

Thus, the instantaneous score can be written using the classical physical decay equation:

$$S(t_{\text{now}}) = \min \left( 100, \sum_{e_i \in \mathcal{V}} w_i \cdot e^{-\left(\frac{\ln(2)}{\tau}\right)(t_{\text{now}} - t_i)} \right)$$

This formulation ensures that if an event of severity $w_i$ occurs at $t_i$, its contributed risk to the active score at $t_i + \tau$ is exactly $\frac{w_i}{2}$, and at $t_i + 2\tau$ is exactly $\frac{w_i}{4}$.

---

## 3. Algorithmic Properties

### 3.1 Superposition and Accumulation
Because the score is calculated as a sum of independent exponential terms, it adheres to the **superposition principle**. If a student commits two violations with severities $w_1$ and $w_2$ at times $t_1$ and $t_2$, the combined score is the sum of their individual decayed components:

$$S(t_{\text{now}}) = \min\left(100, w_1 2^{-\frac{t_{\text{now}}-t_1}{\tau}} + w_2 2^{-\frac{t_{\text{now}}-t_2}{\tau}}\right)$$

This allows the score to scale naturally with multi-sensor violations. For example, if a student is looking away ($w_1 = 15$) and simultaneously a phone is detected ($w_2 = 25$), the risk compounds immediately to $40$, rather than treating them as separate isolated incidents.

### 3.2 Asymptotic Convergence to Zero
In the absence of new violations, the score converges asymptotically to zero:

$$\lim_{t_{\text{now}} \to \infty} S(t_{\text{now}}) = 0$$

This provides the system with a "forgiveness window." For instance, if a student triggers a medium-severity violation ($w_i = 15$), and then exhibits exemplary behavior, the score decays back to negligible values, as illustrated below:

| Elapsed Time (s) | $t_{\text{now}} - t_i$ | Contributed Score |
|------------------|----------------------|-------------------|
| 0 (Immediate)    | $0$                  | $15.00$           |
| 30               | $0.5 \tau$           | $10.61$           |
| 60 (Half-Life)   | $1.0 \tau$           | $7.50$            |
| 120 (2 Half-Lives)| $2.0 \tau$           | $3.75$            |
| 300 (5 Half-Lives)| $5.0 \tau$           | $0.47$            |

### 3.3 Evasion Prevention via Peak Monotonicity
To prevent students from committing severe infractions and simply waiting out the decay period before submitting, the system tracks the historical peak score $S_{\text{peak}}(t_{\text{now}})$. Let $t_{\text{start}}$ be the session start time:

$$S_{\text{peak}}(t_{\text{now}}) = \max_{t \in [t_{\text{start}}, t_{\text{now}}]} S(t)$$

This peak score is monotonically non-decreasing:

$$\frac{d}{dt} S_{\text{peak}}(t) \ge 0$$

The final cheating score submitted to the database and displayed during post-exam review is $S_{\text{peak}}$, ensuring that any critical risk reached during the session is permanently preserved for instructor review.

---

## 4. Canonical Violation Taxonomy

The severity weight $w_i$ is determined by a static, single source of truth: the `VIOLATION_TAXONOMY` mapping. It classifies violations into four distinct tiers based on severity:

| Violation Key | Severity Tier | Score Weight ($w_i$) | Description |
| :--- | :--- | :---: | :--- |
| **`multiple_faces`** | Critical | **25** | Multiple faces detected in the camera frame |
| **`phone_detected`** | Critical | **25** | Mobile phone detected in frame |
| **`tab_switch_prolonged`** | Critical | **25** | Browser tab lost focus for an extended duration |
| **`gaze_prolonged_away`** | Critical | **25** | Student gaze off-screen for an extended period |
| **`camera_unavailable`** | Critical | **25** | Camera stream became unavailable (legacy compatibility) |
| **`multiple_persons`** | Critical | **25** | Multiple persons detected in frame (legacy compatibility) |
| **`eye_closure`** | High | **20** | Eyes closed for a suspicious duration |
| **`face_not_detected`** | High | **20** | No face detected in the camera frame |
| **`window_minimize`** | High | **20** | Exam window was minimized |
| **`ip_address_change`** | High | **20** | Student IP address changed during the session |
| **`face_not_visible`** | High | **20** | Face not detected in frame (legacy compatibility) |
| **`gaze_sustained_away`** | Medium | **15** | Student gaze consistently off-screen |
| **`tab_switch`** | Medium | **15** | Browser tab lost focus |
| **`head_pose_extreme`** | Medium | **15** | Extreme head rotation detected |
| **`answer_pattern_suspicious`**| Medium | **15** | Suspicious answer timing or pattern detected |
| **`gaze_off_screen`** | Medium | **15** | Student gaze directed away from screen (legacy) |
| **`rapid_eye_movement`** | Medium-Low | **10** | Rapid eye movements indicative of reading external material |
| **`tab_focus_lost`** | Medium-Low | **10** | Browser tab lost focus (legacy compatibility) |
| **`gaze_looking_away`** | Low | **5** | Student gaze directed away from screen (brief) |
| **`excessive_blinking`** | Low | **5** | Highly frequent blinking pattern detected |
| **`face_too_close`** | Low | **5** | Student face is too close to the camera |
| **`face_too_far`** | Low | **5** | Student face is too far from the camera |
| **`head_pose_moderate`** | Low | **5** | Moderate head rotation detected |

---

## 5. Thresholds & Real-Time Alert System

### 5.1 Risk Level Bands
The system translates the continuous instantaneous score $S(t_{\text{now}})$ into a discrete risk tier for UI rendering and notification routing. Let $\theta_{\text{warn}}$ be the warning threshold and $\theta_{\text{crit}}$ be the critical threshold. These parameters are defined within the `ProctoringPolicy` (defaulting to $\theta_{\text{warn}} = 40$ and $\theta_{\text{crit}} = 70$).

$$\text{RiskBand}(S(t)) = \begin{cases} 
\text{Low (Green)} & 0 \le S(t) < \frac{\theta_{\text{warn}}}{2} \\ 
\text{Medium (Yellow)} & \frac{\theta_{\text{warn}}}{2} \le S(t) < \theta_{\text{warn}} \\ 
\text{High (Orange)} & \theta_{\text{warn}} \le S(t) < \theta_{\text{crit}} \\ 
\text{Critical (Red)} & \theta_{\text{crit}} \le S(t) \le 100 
\end{cases}$$

### 5.2 Latching Mechanism
To prevent a rapid succession of UI state changes (e.g., the student seeing warnings blink on and off due to transient mathematical decay), the client-side tracker implements **threshold latching**. Once a threshold is crossed, the crossed state is locked to `true` for the rest of the session:

$$\text{Crossed}_{\text{warn}}(t_{\text{now}}) = \bigvee_{t \in [t_{\text{start}}, t_{\text{now}}]} \Big( S(t) \ge \theta_{\text{warn}} \Big)$$

$$\text{Crossed}_{\text{crit}}(t_{\text{now}}) = \bigvee_{t \in [t_{\text{start}}, t_{\text{now}}]} \Big( S(t) \ge \theta_{\text{crit}} \Big)$$

This ensures that once a warning or critical banner is triggered on the student's screen, it remains active, giving clear notice that proctoring alerts have been logged.

### 5.3 Sustained Criticality Alerts
To distinguish between brief, high-intensity alerts and persistent violations, the server implements a duration-based "sustain filter." Let $t_{\text{above}}$ be the continuous time interval during which $S(t) \ge \theta_{\text{crit}}$. An official instructor-facing `critical_score_sustained` alert is raised if and only if:

$$\int_{t_{\text{now}} - T_{\text{sustain}}}^{t_{\text{now}}} \mathbb{I}\Big(S(t) \ge \theta_{\text{crit}}\Big) \, dt = T_{\text{sustain}}$$

where:
* $\mathbb{I}$ is the indicator function.
* $T_{\text{sustain}}$ is the `critical_sustain_seconds` parameter defined in the exam's proctoring policy.

### 5.4 Specialized Coalesced Alerts
Certain critical events immediately trigger specific alerts, bypassing the score decay engine entirely:
* **Camera Loss Alert:** Triggered instantly upon a `camera_unavailable` violation event.
* **Coalesced Multi-Person Alert:** Triggered upon a `multiple_persons` (or `multiple_faces`) event. To avoid alert storms (e.g., if a student's sibling stands behind them for 30 seconds, generating 15 frames of violations), these alerts are coalesced:

$$\Delta t_{\text{alert}} = t_{\text{now}} - t_{\text{last\_alert}} > 30 \text{ seconds}$$

---

## 6. System Architecture and Distributed Authority

The system implements a **distributed state-synchronization pattern** to enforce security and prevent cheating score manipulation.

```
┌──────────────────────────────────────┐          ┌────────────────────────────────────────┐
│             STUDENT CLIENT           │          │            POSTGRES BACKEND            │
│  ┌────────────────────────────────┐  │          │  ┌──────────────────────────────────┐  │
│  │   Multi-Sensor Telemetry       │  │          │  │     record_violation_batch RPC   │  │
│  │  (Gaze, Face, Tab Focus, Pose) │  │          │  └────────────────┬─────────────────┘  │
│  └────────────────┬───────────────┘  │          │                   │                    │
│                   │ (Raw Events)     │          │                   ▼                    │
│                   ▼                  │          │  ┌──────────────────────────────────┐  │
│  ┌────────────────────────────────┐  │          │  │   Insert & Deduplicate Events    │  │
│  │     IndexedDB Event Queue      │  │          │  │     (ON CONFLICT DO NOTHING)     │  │
│  └────────────────┬───────────────┘  │          │  └────────────────┬─────────────────┘  │
│                   │                  │          │                   │                    │
│                   │ Batched RPC      │          │                   ▼                    │
│                   │ (Every 2s/50ev)  │          │  ┌──────────────────────────────────┐  │
│                   └──────────────────┼─────────►│  │  Authoritative Decay Calculation │  │
│                                      │          │  │     S(t) & peak_cheating_score   │  │
│  ┌────────────────────────────────┐  │          │  └────────────────┬─────────────────┘  │
│  │     Student Warning UI         │  │          │                   │                    │
│  │ (Latched thresholds from RPC)  │◄─┼──────────┼───────────────────┘                    │
│  └────────────────────────────────┘  │          │                   │                    │
└──────────────────────────────────────┘          │                   ▼                    │
                                                  │  ┌──────────────────────────────────┐  │
                                                  │  │     Instructor Alert Engine      │  │
                                                  │  │ (Real-Time Socket Notification)  │  │
                                                  │  └──────────────────────────────────┘  │
                                                  └────────────────────────────────────────┘
```

1. **Client-Side Capture and Local Queueing:** 
   The browser captures sensor triggers, maps them to the canonical taxonomy, and appends them to a persistent client-side queue (using `IndexedDB`). This prevents loss of events in the event of transient network failure (offline periods).
2. **Batched Transmittance:** 
   Every 2 seconds (or every 50 events, whichever is reached first), the client flushes its queue to the Postgres database via the `record_violation_batch(session_id uuid, events jsonb)` RPC.
3. **Deduplication and Idempotency:** 
   The RPC iterates through the batch, performing an upsert operation:
   $$\text{INSERT INTO violation\_events} \dots \text{ON CONFLICT (session\_id, client\_event\_id) DO NOTHING}$$
   This guarantees **exactly-once** processing even if a batch is sent multiple times due to TCP retransmissions or client reconnections.
4. **Authoritative Calculation:** 
   The backend recomputes $S(t_{\text{now}})$ inside the RPC transaction:
   ```sql
   SELECT LEAST(100.0, COALESCE(SUM(
     ve.severity * POWER(2, -EXTRACT(EPOCH FROM (v_now - ve.server_recorded_at)) / 60.0)
   ), 0))
   INTO v_score
   FROM public.violation_events ve
   WHERE ve.session_id = p_session_id;
   ```
   The client receives the computed $S(t_{\text{now}})$ in the RPC response and updates its local state. By keeping the scoring calculation inside the Postgres backend, the student cannot spoof, intercept, or modify their cheating score.

---

## 7. Conclusion

By modeling online proctoring violations through the lens of continuous, severity-weighted exponential decay, this system effectively bridges the gap between raw web telemetry and high-confidence cheating risk evaluation. The mathematical superposition handles multi-sensor compounding naturally, while the temporal half-life parameters filter transient, non-malicious noise. When paired with server-side authoritative calculations, peak score tracking, and threshold-based risk-tiering, the proctoring engine provides a secure, reliable, and fair environment for modern academic testing.
