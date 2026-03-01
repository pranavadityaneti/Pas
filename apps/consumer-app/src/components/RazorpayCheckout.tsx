// RazorpayCheckout: WebView-based Razorpay payment modal for Expo Go compatibility.
// Uses Razorpay's Checkout.js loaded in a WebView — no native modules required.
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

interface RazorpayCheckoutProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: (paymentId: string) => void;
    onError: (error: string) => void;
    amount: number; // in rupees
    restaurantName: string;
    userEmail?: string;
    userPhone?: string;
}

const RAZORPAY_KEY_ID = 'rzp_test_RnWZnS9NxCVC6V';

// Sanitize strings for safe HTML embedding
const sanitize = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/'/g, "\\'").replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function RazorpayCheckout({
    visible,
    onClose,
    onSuccess,
    onError,
    amount,
    restaurantName,
    userEmail = 'customer@pas.app',
    userPhone = '9999999999',
}: RazorpayCheckoutProps) {
    const [webviewKey, setWebviewKey] = useState(0);

    // Reset WebView on each open to prevent stale state
    useEffect(() => {
        if (visible) setWebviewKey(k => k + 1);
    }, [visible]);

    const amountInPaise = Math.round(Math.max(amount, 1) * 100);
    const safeName = sanitize(restaurantName);

    const checkoutHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #FFFFFF;
            }
        </style>
    </head>
    <body>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <script>
            var options = {
                key: '${RAZORPAY_KEY_ID}',
                amount: ${amountInPaise},
                currency: 'INR',
                name: 'PAS',
                description: 'Pre-order at ${safeName}',
                prefill: {
                    email: '${userEmail}',
                    contact: '${userPhone}'
                },
                theme: {
                    color: '#B52725'
                },
                handler: function(response) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'SUCCESS',
                        paymentId: response.razorpay_payment_id
                    }));
                },
                modal: {
                    ondismiss: function() {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'DISMISSED'
                        }));
                    },
                    escape: false,
                    confirm_close: true
                }
            };

            var rzp = new Razorpay(options);
            rzp.on('payment.failed', function(response) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'ERROR',
                    error: response.error.description || 'Payment failed'
                }));
            });
            rzp.open();
        </script>
    </body>
    </html>
    `;

    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'SUCCESS') {
                onSuccess(data.paymentId);
            } else if (data.type === 'ERROR') {
                onError(data.error);
            } else if (data.type === 'DISMISSED') {
                onClose();
            }
        } catch (e) {
            console.error('Razorpay message parse error:', e);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'ios' ? 10 : 0 }}>
                <WebView
                    key={webviewKey}
                    source={{ html: checkoutHTML }}
                    onMessage={handleMessage}
                    javaScriptEnabled
                    domStorageEnabled
                    startInLoadingState
                    renderLoading={() => (
                        <View style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: '#FFFFFF',
                            alignItems: 'center', justifyContent: 'center'
                        }}>
                            <ActivityIndicator size="large" color="#B52725" />
                            <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '500', marginTop: 12 }}>
                                Opening payment gateway...
                            </Text>
                        </View>
                    )}
                    style={{ flex: 1 }}
                />
            </View>
        </Modal>
    );
}
