/* ==========================================
   Chat-With-AI Provider Integration
   Endpoint : http://localhost:8081/ai/demo?q=
   ========================================== */

(function () {

    const ORIGINAL_SEND = window.sendMessage;

    window.sendMessage = async function (e) {

        const provider =
            document.getElementById("provider-select")?.value;

        if (provider !== "chatwithai") {
            return ORIGINAL_SEND(e);
        }

        e.preventDefault();

        const box = document.getElementById("prompt");
        const question = box.value.trim();

        if (!question) return;

        box.value = "";

        if (typeof updateCharCount === "function") {
            updateCharCount();
        }

        appendUserBubble(question);

        document.getElementById("send-btn").disabled = true;

        try {

            const bubble = createStreamingBubble();

            const response = await fetch(
                "http://localhost:8081/ai/demo?q=" +
                encodeURIComponent(question)
            );

            if (!response.ok) {
                throw new Error("Server Error");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let result = "";

            while (true) {

                const { done, value } =
                    await reader.read();

                if (done) break;

                const chunk =
                    decoder.decode(value, {
                        stream: true
                    });

                result += chunk;

                const p =
                    bubble.querySelector("p");

                p.textContent = result;

                scrollLog();
            }

            bubble.querySelector("p")
                .classList.remove("streaming-cursor");

            pushHistory(question, result);

        } catch (err) {

            appendBotBubble(
                "Unable to connect Chat-With-AI service.",
                [],
                "error"
            );

            console.error(err);

        } finally {

            document.getElementById(
                "send-btn"
            ).disabled = false;

            turnCount++;

            document.getElementById(
                "display-turns"
            ).textContent = turnCount;
        }
    };

    const originalProviderChange =
        window.onProviderChange;

    window.onProviderChange = function () {

        if (originalProviderChange) {
            originalProviderChange();
        }

        const provider =
            document.getElementById(
                "provider-select"
            ).value;

        if (provider === "chatwithai") {

            const model =
                document.getElementById(
                    "active-model-label"
                );

            if (model) {
                model.textContent =
                    "Chat-With-AI · Spring AI";
            }

            const warning =
                document.getElementById(
                    "config-warning"
                );

            if (warning) {
                warning.classList.remove(
                    "hidden"
                );

                warning.textContent =
                    "Connected to localhost:8081";
            }
        }
    };

})();

function speakTextFromButton(btn) {

    speechSynthesis.cancel();

    const bubble = btn.closest('.msg-bubble');
    if (!bubble) return;

    const text = bubble.querySelector('p')?.innerText;
    if (!text) return;

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "hi-IN";
    speech.rate = 1;
    speech.pitch = 1;
    speech.volume = 1;

    const voices = speechSynthesis.getVoices();

    const hindiVoice = voices.find(
        v => v.lang === "hi-IN"
    );

    if (hindiVoice) {
        speech.voice = hindiVoice;
    }

    speechSynthesis.speak(speech);
}