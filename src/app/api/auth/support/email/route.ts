import { NextRequest } from 'next/server';
import { forwardSupportResource } from '@/lib/lexmacasto/support-proxy';

export async function POST(req: NextRequest) {
  return forwardSupportResource(req, 'email', 'store', 'POST');
}
export async function PUT(req: NextRequest) {
  return forwardSupportResource(req, 'email', 'update', 'PUT');
}
export async function DELETE(req: NextRequest) {
  return forwardSupportResource(req, 'email', 'delete', 'DELETE');
}
export async function GET(req: NextRequest) {
  return forwardSupportResource(req, 'email', 'list', 'GET');
}
