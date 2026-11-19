import { NextRequest } from 'next/server';
import { forwardSupportResource } from '@/lib/lexmacasto/support-proxy';

export async function POST(req: NextRequest) {
  return forwardSupportResource(req, 'password', 'store', 'POST');
}
export async function PUT(req: NextRequest) {
  return forwardSupportResource(req, 'password', 'update', 'PUT');
}
export async function DELETE(req: NextRequest) {
  return forwardSupportResource(req, 'password', 'delete', 'DELETE');
}
export async function GET(req: NextRequest) {
  return forwardSupportResource(req, 'password', 'list', 'GET');
}
