import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    item: any; // Type accurately later with DB types
    onUpdate: (id: string, updates: any) => void;
    onDelete: (id: string) => void;
    onToggleStatus: (id: string, currentStatus: boolean) => void;
}

export default function InventoryCard({ item, onUpdate, onDelete, onToggleStatus }: Props) {
    // Local state for inputs to allow smooth typing (debounce updates in parent)
    const [sellingPrice, setSellingPrice] = useState(item.sellingPrice?.toString() || item.price?.toString() || '');
    const [stock, setStock] = useState(item.stock?.toString() || '0');

    useEffect(() => {
        // Sync if parent updates
        setSellingPrice(item.sellingPrice?.toString() || item.price?.toString() || '');
        setStock(item.stock?.toString() || '0');
    }, [item.price, item.stock, item.sellingPrice]);

    const handlePriceChange = (text: string) => {
        setSellingPrice(text);
        // In a real app, use a debounce hook here to call onUpdate
        // For now, onEndEditing will trigger save
    };

    const handleStockChange = (text: string) => {
        setStock(text);
    };

    const saveChanges = () => {
        const priceVal = parseFloat(sellingPrice);
        const stockVal = parseInt(stock, 10);

        if (!isNaN(priceVal) && !isNaN(stockVal)) {
            // Validation: Selling Price <= MRP
            // MRP might be 0 if not set, so we only validate if MRP > 0
            if (mrp > 0 && priceVal > mrp) {
                Alert.alert(
                    "Invalid Price",
                    `Selling price (₹${priceVal}) cannot be higher than MRP (₹${mrp}).`,
                    [{ text: "OK", onPress: () => setSellingPrice(mrp.toString()) }]
                );
                return;
            }

            onUpdate(item.id, { price: priceVal, stock: stockVal });
        }
    };

    // Calculate discount
    const mrp = item.product?.mrp || item.mrp || 0;
    const price = parseFloat(sellingPrice) || mrp;
    const discount = mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;

    return (
        <View style={styles.card}>
            {/* Header Row */}
            <View style={styles.headerRow}>
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: item.product?.image || item.image || 'https://placehold.co/100x100' }}
                        style={styles.image}
                    />
                    {discount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{discount}% OFF</Text></View>}
                </View>

                <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={2}>{item.product?.name || item.name}</Text>
                    <Text style={styles.category}>{item.product?.category || item.category || 'General'}</Text>
                    {/* Low Stock Indicator */}
                    {parseInt(stock) < 5 && item.active && (
                        <View style={styles.lowStockBadge}>
                            <Ionicons name="alert-circle" size={12} color="#EF4444" />
                            <Text style={styles.lowStockText}>Low Stock</Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
            </View>

            {/* Toggle Row */}
            <View style={styles.rowBetween}>
                <Text style={[styles.statusLabel, item.active ? styles.textActive : styles.textInactive]}>
                    {item.active ? 'Active on App' : 'Hidden from App'}
                </Text>
                <Switch
                    trackColor={{ false: '#e9e9ea', true: '#34C759' }}
                    thumbColor={'#fff'}
                    ios_backgroundColor="#e9e9ea"
                    onValueChange={() => onToggleStatus(item.id, item.active)}
                    value={item.active}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Grid Inputs */}
            <View style={styles.grid}>
                <View style={styles.gridItem}>
                    <Text style={styles.label}>MRP</Text>
                    <Text style={styles.readOnlyText}>₹{mrp}</Text>
                </View>

                <View style={styles.gridItem}>
                    <Text style={styles.label}>YOUR PRICE</Text>
                    <View style={styles.inputWrap}>
                        <Text style={styles.currency}>₹</Text>
                        <TextInput
                            style={styles.input}
                            value={sellingPrice}
                            onChangeText={handlePriceChange}
                            onEndEditing={saveChanges}
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                <View style={styles.gridItem}>
                    <Text style={styles.label}>STOCK</Text>
                    <TextInput
                        style={[styles.input, styles.stockInput]}
                        value={stock}
                        onChangeText={handleStockChange}
                        onEndEditing={saveChanges}
                        keyboardType="numeric"
                        placeholder="0"
                    />
                </View>

                <View style={styles.gridItem}>
                    <Text style={styles.label}>DISCOUNT</Text>
                    {/* Discount Percentage Calculation */}
                    <Text style={[styles.readOnlyText, { color: '#10B981' }]}>
                        {mrp > 0 && price < mrp
                            ? `${Math.round(((mrp - price) / mrp) * 100)}%`
                            : '0%'}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    headerRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    imageContainer: {
        position: 'relative',
    },
    image: {
        width: 60,
        height: 60,
        borderRadius: 10,
        backgroundColor: '#f8f8f8',
    },
    badge: {
        position: 'absolute',
        bottom: -6,
        left: 0,
        right: 0,
        backgroundColor: '#EF4444',
        borderRadius: 4,
        paddingVertical: 2,
        alignItems: 'center',
    },
    badgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },
    info: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    name: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111',
        lineHeight: 20,
        marginBottom: 4,
    },
    category: {
        fontSize: 13,
        color: '#888',
    },
    deleteBtn: {
        padding: 8,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    statusLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    textActive: {
        color: '#34C759',
    },
    textInactive: {
        color: '#999',
    },
    divider: {
        height: 1,
        backgroundColor: '#f0f0f0',
        marginBottom: 12,
    },
    grid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    gridItem: {
        flex: 1,
        paddingRight: 8,
    },
    label: {
        fontSize: 10,
        color: '#999',
        marginBottom: 4,
        textTransform: 'uppercase',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    readOnlyText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#888',
        paddingTop: 4,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        paddingBottom: 2,
    },
    currency: {
        fontSize: 14,
        color: '#333',
        marginRight: 2,
    },
    input: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        padding: 0,
        minWidth: 40,
    },
    stockInput: {
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        paddingBottom: 2,
    },
    lowStockBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 2
    },
    lowStockText: {
        color: '#EF4444',
        fontSize: 10,
        fontWeight: 'bold'
    }
});
