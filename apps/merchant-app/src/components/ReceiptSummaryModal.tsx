import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Order } from '../hooks/useOrders';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useStore } from '../hooks/useStore';

interface ReceiptSummaryModalProps {
    visible: boolean;
    onClose: () => void;
    order: Order | null;
}

export default function ReceiptSummaryModal({ visible, onClose, order }: ReceiptSummaryModalProps) {
    const { store } = useStore();
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    if (!order) return null;

    const generating = isDownloading || isSharing;

    const generateReceiptHTML = () => {
        const currentDate = new Date().toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                    .store-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
                    .store-details { font-size: 12px; color: #666; }
                    .section { margin: 20px 0; }
                    .section-title { font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { text-align: left; padding: 8px; }
                    th { background-color: #f0f0f0; }
                    .total-row { font-weight: bold; border-top: 2px solid #000; }
                    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #888; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="store-name">${store?.name || 'Pick At Store'}</div>
                    <div class="store-details">${store?.address || ''}</div>
                    <div class="store-details">Receipt #${order.displayId}</div>
                    <div class="store-details">${currentDate}</div>
                </div>

                <div class="section">
                    <div class="section-title">Order Details</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Price</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${order.items.map(item => `
                                <tr>
                                    <td>${item.storeProduct.product.name}</td>
                                    <td>${item.quantity}</td>
                                    <td>₹${item.price}</td>
                                    <td>₹${item.price * item.quantity}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="3">Total</td>
                                <td>₹${order.totalAmount}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="footer">
                    <p>Thank you for your business!</p>
                    <p>Powered by Pick At Store</p>
                </div>
            </body>
            </html>
        `;
    };

    const handleDownload = async () => {
        try {
            setIsDownloading(true);
            const html = generateReceiptHTML();
            const { uri } = await Print.printToFileAsync({ html });
            Alert.alert('Success', 'Receipt saved to device!');
            console.log('Receipt saved to:', uri);
        } catch (error) {
            console.error('Download error:', error);
            Alert.alert('Error', 'Failed to generate receipt');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleShare = async () => {
        try {
            setIsSharing(true);
            const html = generateReceiptHTML();
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Alert.alert('Error', 'Sharing is not available on this device');
            }
        } catch (error) {
            console.error('Share error:', error);
            Alert.alert('Error', 'Failed to share receipt');
        } finally {
            setIsSharing(false);
        }
    };

    const formattedDate = new Date(order.createdAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.celebrationContainer}>
                        <MaterialCommunityIcons name="party-popper" size={50} color="#FFA500" />
                    </View>

                    <Text style={styles.thankYouText}>Thank you!</Text>
                    <Text style={styles.successSubtext}>Order has been completed successfully</Text>

                    <View style={styles.ticketDivider} />

                    <View style={styles.ticketDataGrid}>
                        <View style={styles.dataBlock}>
                            <Text style={styles.dataLabel}>ORDER ID</Text>
                            <Text style={styles.dataValue}>{order.displayId}</Text>
                        </View>
                        <View style={styles.dataBlock}>
                            <Text style={[styles.dataLabel, { textAlign: 'right' }]}>AMOUNT</Text>
                            <Text style={[styles.dataValue, { textAlign: 'right' }]}>₹{order.totalAmount}</Text>
                        </View>
                    </View>

                    <View style={styles.dataBlockFull}>
                        <Text style={styles.dataLabel}>DATE & TIME</Text>
                        <Text style={styles.dataValue}>{formattedDate}</Text>
                    </View>

                    <View style={styles.summaryContainer}>
                        <Text style={styles.summaryTitle}>Order Summary</Text>
                        <ScrollView style={styles.itemList} showsVerticalScrollIndicator={false}>
                            {order.items.map((item, index) => (
                                <View key={index} style={styles.itemRow}>
                                    <View style={styles.itemTextContainer}>
                                        <Text style={styles.itemQty}>{item.quantity}x</Text>
                                        <Text style={styles.itemName} numberOfLines={1}> {item.storeProduct.product.name}</Text>
                                    </View>
                                    <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={[styles.receiptBtn, isDownloading && styles.receiptBtnDisabled]}
                            onPress={handleDownload}
                            disabled={generating}
                        >
                            {isDownloading ? (
                                <ActivityIndicator size="small" color={Colors.primary} />
                            ) : (
                                <>
                                    <Ionicons name="cloud-download-outline" size={20} color={Colors.primary} />
                                    <Text style={styles.receiptBtnText}>Download</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.receiptBtn, { marginLeft: 12 }, isSharing && styles.receiptBtnDisabled]}
                            onPress={handleShare}
                            disabled={generating}
                        >
                            {isSharing ? (
                                <ActivityIndicator size="small" color={Colors.primary} />
                            ) : (
                                <>
                                    <Ionicons name="share-outline" size={20} color={Colors.primary} />
                                    <Text style={styles.receiptBtnText}>Share</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                        <Text style={styles.doneBtnText}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    content: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        width: '100%',
        padding: 24,
        paddingTop: 32,
        alignItems: 'center',
    },
    celebrationContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FFF8E1',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16
    },
    thankYouText: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 4 },
    successSubtext: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
    ticketDivider: { width: '100%', height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 1, marginBottom: 20 },
    ticketDataGrid: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginBottom: 16 },
    dataBlock: { flex: 1 },
    dataBlockFull: { width: '100%', marginBottom: 24 },
    dataLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
    dataValue: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
    summaryContainer: {
        width: '100%',
        backgroundColor: '#F9FAFB',
        borderRadius: 24,
        padding: 16,
        maxHeight: 180,
        marginBottom: 24,
    },
    summaryTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12 },
    itemList: { width: '100%' },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    itemTextContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
    itemQty: { fontSize: 13, fontWeight: '800', color: '#111827' },
    itemName: { fontSize: 13, color: '#4B5563', flex: 1 },
    itemPrice: { fontSize: 14, fontWeight: '700', color: '#111827' },
    actionButtons: {
        flexDirection: 'row',
        width: '100%',
        marginBottom: 16
    },
    receiptBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: Colors.primary,
    },
    receiptBtnText: { color: Colors.primary, fontWeight: '700', marginLeft: 8, fontSize: 14 },
    receiptBtnDisabled: { opacity: 0.5 },
    doneBtn: {
        width: '100%',
        backgroundColor: '#000',
        padding: 18,
        borderRadius: 18,
        alignItems: 'center',
        marginBottom: 10
    },
    doneBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

