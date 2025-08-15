/**
 * Maintenance root = Overview
 */
'use client';
import React from 'react';
import { MaintenanceDashboard } from '../../components/maintenance';

export default function MaintenanceRoot() {
  return <MaintenanceDashboard initialTab="overview" />;
}
